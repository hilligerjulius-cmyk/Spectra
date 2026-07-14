import "dotenv/config";
import { MODEL_CATALOG, type ModelInfo, type ModelProvider } from "@spectra/contracts";

/** Resolved runtime configuration for the Compiler Engine. */
export interface Config {
  readonly port: number;
  readonly host: string;
  readonly anthropic: { readonly apiKey: string | undefined };
  /** Providers that have a configured API key. */
  readonly providers: readonly ModelProvider[];
  /** Models usable given the configured key (subset of the catalog). */
  readonly availableModels: readonly ModelInfo[];
  /** Model used when a request doesn't name one (null when no key → templates). */
  readonly defaultModel: string | null;
  /** True when a provider key is present. */
  readonly llmEnabled: boolean;
  /** Maximum repair attempts before falling back to a deterministic template. */
  readonly maxRepairAttempts: number;
}

function pickDefaultModel(available: readonly ModelInfo[]): string | null {
  if (available.length === 0) return null;
  const requested = process.env.SPECTRA_DEFAULT_MODEL?.trim();
  if (requested && available.some((m) => m.id === requested)) return requested;
  // Prefer a balanced default, then anything available.
  const balanced = available.find((m) => m.tier === "balanced") ?? available.find((m) => m.tier === "fast");
  return (balanced ?? available[0]!).id;
}

export function loadConfig(): Config {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim() || undefined;

  const providers: ModelProvider[] = anthropicKey ? ["anthropic"] : [];
  const availableModels = MODEL_CATALOG.filter((m) => providers.includes(m.provider));

  return {
    port: Number(process.env.PORT ?? 4000),
    host: process.env.HOST ?? "0.0.0.0",
    anthropic: { apiKey: anthropicKey },
    providers,
    availableModels,
    defaultModel: pickDefaultModel(availableModels),
    llmEnabled: providers.length > 0,
    maxRepairAttempts: Number(process.env.SPECTRA_MAX_REPAIR ?? 2),
  };
}

export const config = loadConfig();
