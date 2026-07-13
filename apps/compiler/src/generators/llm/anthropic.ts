import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "../../config";
import type { Generator, GenerationRequest } from "../index";
import { log } from "../../util/logger";
import { SYSTEM_PROMPT, buildUserPrompt, buildRepairPrompt } from "./prompt";
import { extractComponentSource } from "./schema";

/**
 * The Anthropic adapter. Activated only when `SPECTRA_LLM=anthropic` and a key
 * is present. Its output is NEVER trusted — it flows through the same
 * validate → compile → repair loop as any other candidate, with a deterministic
 * template as the ultimate fallback.
 */
export function createAnthropicGenerator(config: Config): Generator | null {
  if (!config.anthropic.apiKey) return null;
  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const model = config.anthropic.model;

  const complete = async (userContent: string): Promise<string> => {
    const message = await client.messages.create({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return extractComponentSource(text);
  };

  return {
    kind: "anthropic",
    async generate(req: GenerationRequest) {
      log.info("llm:generate", { model, archetype: req.archetype });
      const source = await complete(buildUserPrompt(req));
      return { source, strategy: "anthropic" };
    },
    async repair(_req, previous, errors) {
      log.warn("llm:repair", { errors: errors.length });
      const source = await complete(buildRepairPrompt(previous, errors));
      return { source, strategy: "anthropic" };
    },
  };
}
