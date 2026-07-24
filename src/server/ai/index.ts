import { env, providerStatus } from "@/lib/env";
import { AnthropicProvider } from "./anthropic";
import { ScriptedProvider } from "./scripted";
import type { AIProvider } from "./types";

export * from "./types";
export * from "./schemas";
export { estimateCostDeciCents } from "./anthropic";

let cached: AIProvider | null = null;

/**
 * Liefert den aktiven KI-Provider:
 * - Mit ANTHROPIC_API_KEY: echte Anthropic-Modelle (Standard: claude-opus-5).
 * - Ohne Key: deterministischer ScriptedProvider (Demo-/Sandbox-Modus).
 * Sandbox-Testläufe verwenden IMMER den ScriptedProvider (reproduzierbar,
 * kostenlos, ohne echte Systeme).
 */
export function getAIProvider(options?: { sandbox?: boolean }): AIProvider {
  if (options?.sandbox) return new ScriptedProvider();
  if (!cached) {
    cached = providerStatus.anthropic
      ? new AnthropicProvider(env.ANTHROPIC_API_KEY!)
      : new ScriptedProvider();
  }
  return cached;
}
