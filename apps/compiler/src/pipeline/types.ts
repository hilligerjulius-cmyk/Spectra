import type { GenerationStrategy, PhaseEvent } from "@spectra/contracts";

/** Normalized intent + resolved archetype produced by the ingest stage. */
export interface IngestResult {
  readonly raw: string;
  readonly normalized: string;
  readonly archetype: string;
  /** Human-facing title, e.g. "Kanban Board". */
  readonly title: string;
  /** Extracted generation parameters (accent, seed content, …). */
  readonly params: TemplateContext;
  /** Which strategy will run for this request. */
  readonly strategy: "deterministic" | "anthropic";
}

/** Parameters handed to a deterministic template / the LLM prompt. */
export interface TemplateContext {
  readonly title: string;
  readonly intent: string;
  /** A spectral accent hex chosen from the intent. */
  readonly accent: string;
}

/** Output of a generation attempt. */
export interface GenerateResult {
  /** Raw TSX/JSX component source (a default-exported React component). */
  readonly source: string;
  readonly strategy: GenerationStrategy;
}

/** Result of static validation (AST parse + contract + policy). */
export interface ValidateResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

/** Result of esbuild compilation. */
export interface CompileResult {
  readonly ok: boolean;
  readonly bundle?: string;
  readonly errors: readonly string[];
}

/** Emitter that streams pipeline phase events to the client. */
export type Emit = (event: PhaseEvent) => void;
