/**
 * The model catalog — the Claude models Spectra can generate with.
 * The UI only shows models whose provider API key is configured on the server.
 */

export type ModelProvider = "anthropic";

export type ModelTier = "fast" | "balanced" | "powerful" | "frontier";

export interface ModelInfo {
  /** The provider's API model id. */
  readonly id: string;
  readonly provider: ModelProvider;
  /** Human label shown in the picker. */
  readonly label: string;
  readonly tier: ModelTier;
  /** One-line description for the picker. */
  readonly blurb: string;
  /**
   * Whether the model accepts `output_config.effort` + adaptive thinking.
   * Haiku 4.5 does not.
   */
  readonly supportsEffort?: boolean;
}

export const MODEL_CATALOG: readonly ModelInfo[] = [
  { id: "claude-haiku-4-5", provider: "anthropic", label: "Claude Haiku 4.5", tier: "fast", blurb: "Fastest · lowest cost", supportsEffort: false },
  { id: "claude-sonnet-5", provider: "anthropic", label: "Claude Sonnet 5", tier: "balanced", blurb: "Balanced quality & speed", supportsEffort: true },
  { id: "claude-opus-4-8", provider: "anthropic", label: "Claude Opus 4.8", tier: "powerful", blurb: "Highest quality", supportsEffort: true },
  { id: "claude-fable-5", provider: "anthropic", label: "Claude Fable 5", tier: "frontier", blurb: "Most capable · premium", supportsEffort: true },
];

export function findModel(id: string): ModelInfo | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}

/** Response of GET /models — which models are usable given the configured key. */
export interface ModelsResponse {
  /** Models whose provider key is present on the server. */
  readonly available: readonly ModelInfo[];
  /** The id the engine uses when a request doesn't specify one (or null if none). */
  readonly defaultModel: string | null;
  /** Providers with a configured key. */
  readonly providers: readonly ModelProvider[];
}
