import type { ModelInfo } from "@spectra/contracts";
import type { Config } from "../../config";
import { completeAnthropic } from "./anthropic";
import { completeOpenAI } from "./openai";
import { extractComponentSource } from "./schema";

/** Route a completion to the right provider and sanitize it to raw TSX. */
export async function completeModel(
  model: ModelInfo,
  config: Config,
  system: string,
  user: string,
): Promise<string> {
  let raw: string;
  if (model.provider === "anthropic") {
    if (!config.anthropic.apiKey) throw new Error("Anthropic API key is not configured.");
    raw = await completeAnthropic(config.anthropic.apiKey, model, system, user);
  } else {
    if (!config.openai.apiKey) throw new Error("OpenAI API key is not configured.");
    raw = await completeOpenAI(config.openai.apiKey, model, system, user);
  }
  return extractComponentSource(raw);
}
