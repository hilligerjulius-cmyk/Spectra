import Anthropic from "@anthropic-ai/sdk";
import type { ModelInfo } from "@spectra/contracts";

/**
 * One completion from a Claude model. Uses adaptive thinking + medium effort on
 * models that support it (Opus 4.8/4.7, Sonnet 5, Fable 5); Haiku 4.5 rejects
 * those, so it runs a plain request. No sampling params (removed on 4.7+).
 */
export async function completeAnthropic(
  apiKey: string,
  model: ModelInfo,
  system: string,
  user: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
    model: model.id,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  };
  if (model.supportsEffort) {
    // Typed loosely: these fields exist on current models but may post-date the
    // installed SDK's param types.
    const extra = params as unknown as Record<string, unknown>;
    extra.thinking = { type: "adaptive" };
    extra.output_config = { effort: "medium" };
  }

  const message = await client.messages.create(params);
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
