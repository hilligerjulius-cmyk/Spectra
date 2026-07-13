import type { AppManifest } from "./manifest";

/** The request body for POST /materialize. */
export interface MaterializeRequest {
  /** Raw natural-language intent from the user. */
  readonly intent: string;
  readonly options?: {
    /** Force a strategy; otherwise the engine decides from configuration. */
    readonly strategy?: "auto" | "deterministic" | "anthropic";
    /** Bypass the content-addressed cache. */
    readonly noCache?: boolean;
  };
}

/** The ordered stages of the compilation pipeline. */
export type PhaseName =
  | "ingest"
  | "generate"
  | "validate"
  | "compile"
  | "repair"
  | "package";

/** Fixed, ordered list of phases — used by the canvas to render the ticker. */
export const PHASE_ORDER: readonly PhaseName[] = [
  "ingest",
  "generate",
  "validate",
  "compile",
  "package",
] as const;

export type PhaseStatus = "start" | "ok" | "warn" | "error";

/** A streamed pipeline event (Server-Sent Event `data:` payload). */
export type PhaseEvent =
  | {
      readonly kind: "phase";
      readonly phase: PhaseName;
      readonly status: PhaseStatus;
      /** Human, present-tense label, e.g. "Validating syntax tree". */
      readonly label: string;
      /** 0..1 overall pipeline progress. */
      readonly progress: number;
      /** Optional detail (e.g. repair attempt count, archetype name). */
      readonly detail?: string;
      readonly at: number;
    }
  | {
      readonly kind: "done";
      readonly result: MaterializeResult;
      readonly at: number;
    }
  | {
      readonly kind: "error";
      readonly message: string;
      readonly at: number;
    };

/** The terminal success payload delivered inside a `done` event. */
export interface MaterializeResult {
  readonly manifest: AppManifest;
  /** Compiled ES module source. `react`/`react-dom` are left as external imports. */
  readonly bundle: string;
  /** Whether this result was served from cache. */
  readonly cached: boolean;
}

/** SSE event name used on the wire. */
export const SSE_EVENT = "spectra" as const;
