/**
 * AppManifest — the descriptor that travels with every materialized application.
 * It is produced by the Compiler Engine and consumed by the Spectra Canvas to
 * label, theme, and mount the generated app.
 */

/** A single declared prop the generated component accepts (documentation + future controls). */
export interface PropSpec {
  readonly name: string;
  readonly type: "string" | "number" | "boolean" | "enum" | "array" | "object";
  readonly description?: string;
  readonly options?: readonly string[];
  readonly default?: unknown;
}

/** Design tokens echoed into the manifest so the sandbox can theme the frame. */
export interface ManifestTokens {
  readonly accent: string;
  readonly surface: string;
  readonly text: string;
}

/**
 * How a materialized app was produced. Lets the canvas surface provenance and
 * lets us reason about trust boundaries.
 */
export type GenerationStrategy =
  | "deterministic"
  | "anthropic"
  | "openai"
  | "repair-fallback";

export interface AppManifest {
  /** Stable content-addressed id (== bundle hash). */
  readonly id: string;
  /** Human-facing title, e.g. "Kanban Board". */
  readonly name: string;
  /** One-line description of what materialized. */
  readonly description: string;
  /** The archetype resolved from intent, e.g. "kanban". */
  readonly archetype: string;
  /** Props the component accepts. */
  readonly props: readonly PropSpec[];
  /** Theme hints for the mounting frame. */
  readonly tokens: ManifestTokens;
  /** Content hash of the compiled bundle (integrity + cache key). */
  readonly hash: string;
  /** How this app was generated. */
  readonly strategy: GenerationStrategy;
  /** The model id that generated it, when an LLM was used (else null). */
  readonly model: string | null;
  /** Wall-clock milliseconds the pipeline took end-to-end. */
  readonly elapsedMs: number;
  /** ISO timestamp of materialization. */
  readonly createdAt: string;
}
