import type { ModelInfo } from "@spectra/contracts";
import type { Config } from "../../config";
import { completeAnthropic } from "./anthropic";
import { extractComponentSource } from "./schema";

/** Run a completion against the model's provider and sanitize it to raw TSX. */
export async function completeModel(
  model: ModelInfo,
  config: Config,
  system: string,
  user: string,
): Promise<string> {
  if (!config.anthropic.apiKey) throw new Error("Anthropic API key is not configured.");
  const raw = await completeAnthropic(config.anthropic.apiKey, model, system, user);
  return extractComponentSource(raw);
}
