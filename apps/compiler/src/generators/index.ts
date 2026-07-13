import type { Config } from "../config";
import type { GenerateResult, TemplateContext } from "../pipeline/types";
import { resolveTemplate } from "./deterministic/registry";
import { createAnthropicGenerator } from "./llm/anthropic";

export interface GenerationRequest {
  readonly intent: string;
  readonly archetype: string;
  readonly params: TemplateContext;
}

/** A pluggable generation strategy. */
export interface Generator {
  readonly kind: "deterministic" | "anthropic";
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
  async generate(req) {
    return { source: resolveTemplate(req.archetype)(req.params), strategy: "deterministic" };
  },
  // Deterministic output is valid by construction; "repair" just re-emits it.
  async repair(req) {
    return { source: resolveTemplate(req.archetype)(req.params), strategy: "deterministic" };
  },
};

/** Produce a guaranteed-valid template as the ultimate fallback. */
export function deterministicFallback(req: GenerationRequest): string {
  return resolveTemplate(req.archetype)(req.params);
}

/** Choose the active generator based on configuration. */
export function selectGenerator(config: Config): Generator {
  if (config.llmEnabled) {
    const llm = createAnthropicGenerator(config);
    if (llm) return llm;
  }
  return deterministicGenerator;
}
