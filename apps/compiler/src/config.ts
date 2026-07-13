import "dotenv/config";

/** Resolved runtime configuration for the Compiler Engine. */
export interface Config {
  readonly port: number;
  readonly host: string;
  /** Which generation strategy the engine defaults to. */
  readonly strategy: "deterministic" | "anthropic";
  /** True only when anthropic strategy is selected AND a key is present. */
  readonly llmEnabled: boolean;
  readonly anthropic: {
    readonly apiKey: string | undefined;
    readonly model: string;
  };
  /** Maximum repair attempts before falling back to a deterministic template. */
  readonly maxRepairAttempts: number;
}

function readStrategy(): "deterministic" | "anthropic" {
  const raw = (process.env.SPECTRA_LLM ?? "deterministic").toLowerCase();
  return raw === "anthropic" || raw === "llm" ? "anthropic" : "deterministic";
}

export function loadConfig(): Config {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || undefined;
  const strategy = readStrategy();
  return {
    port: Number(process.env.PORT ?? 4000),
    host: process.env.HOST ?? "0.0.0.0",
    strategy,
    llmEnabled: strategy === "anthropic" && Boolean(apiKey),
    anthropic: {
      apiKey,
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
    },
    maxRepairAttempts: Number(process.env.SPECTRA_MAX_REPAIR ?? 2),
  };
}

export const config = loadConfig();
