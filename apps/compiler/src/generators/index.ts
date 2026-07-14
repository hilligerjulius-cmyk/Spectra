import type { GenerationStrategy, ModelInfo } from "@spectra/contracts";
import type { Config } from "../config";
import type { GenerateResult, TemplateContext } from "../pipeline/types";
import { resolveTemplate } from "./deterministic/registry";
import { completeModel } from "./llm/complete";
import { SYSTEM_PROMPT, buildUserPrompt, buildRepairPrompt } from "./llm/prompt";
import { log } from "../util/logger";

export interface GenerationRequest {
  readonly intent: string;
  readonly archetype: string;
  readonly params: TemplateContext;
}

/** A pluggable generation strategy. */
export interface Generator {
  readonly kind: "deterministic" | "llm";
  readonly strategy: GenerationStrategy;
  /** The model id backing this generator, or null for the deterministic one. */
  readonly modelId: string | null;
  generate(req: GenerationRequest): Promise<GenerateResult>;
  repair(
    req: GenerationRequest,
    previous: string,
    errors: readonly string[],
  ): Promise<GenerateResult>;
}

/** The deterministic generator — instant, offline, always valid. */
export const deterministicGenerator: Generator = {
  kind: "deterministic",
  strategy: "deterministic",
  modelId: null,
  async generate(req) {
    return { source: resolveTemplate(req.archetype)(req.params), strategy: "deterministic" };
  },
  // Deterministic output is valid by construction; "repair" just re-emits it.
  async repair(req) {
    return { source: resolveTemplate(req.archetype)(req.params), strategy: "deterministic" };
  },
};

/** Build an LLM generator bound to a specific Claude model. */
export function createLlmGenerator(model: ModelInfo, config: Config): Generator {
  const strategy: GenerationStrategy = "anthropic";
  return {
    kind: "llm",
    strategy,
    modelId: model.id,
    async generate(req) {
      log.info("llm:generate", { model: model.id, archetype: req.archetype });
      const source = await completeModel(model, config, SYSTEM_PROMPT, buildUserPrompt(req));
      return { source, strategy };
    },
    async repair(_req, previous, errors) {
      log.warn("llm:repair", { model: model.id, errors: errors.length });
      const source = await completeModel(model, config, SYSTEM_PROMPT, buildRepairPrompt(previous, errors));
      return { source, strategy };
    },
  };
}

/** Produce a guaranteed-valid template as the ultimate fallback. */
export function deterministicFallback(req: GenerationRequest): string {
  return resolveTemplate(req.archetype)(req.params);
}

/**
 * Choose the active generator. Prefers the requested model, then the configured
 * default; falls back to the offline deterministic generator when no provider
 * key is present or the requested model isn't available.
 */
export function selectGenerator(config: Config, requestedModelId?: string): Generator {
  if (!config.llmEnabled) return deterministicGenerator;
  const wanted = requestedModelId
    ? config.availableModels.find((m) => m.id === requestedModelId)
    : undefined;
  const model = wanted ?? config.availableModels.find((m) => m.id === config.defaultModel);
  return model ? createLlmGenerator(model, config) : deterministicGenerator;
}
