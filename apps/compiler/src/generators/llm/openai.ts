import OpenAI from "openai";
import type { ModelInfo } from "@spectra/contracts";

/**
 * One completion from an OpenAI chat model. Kept to the minimal, maximally
 * compatible parameter set (`model` + `messages`) so it works across GPT-4.x,
 * GPT-4o, GPT-5, and reasoning models — which reject `temperature` and use
 * `max_completion_tokens` rather than `max_tokens`.
 */
export async function completeOpenAI(
  apiKey: string,
  model: ModelInfo,
  system: string,
  user: string,
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const res = await client.chat.completions.create({
    model: model.id,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}
