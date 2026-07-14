import { transformSync } from "esbuild";
import type { CompileResult } from "../types";

/**
 * Compile TSX → ESM with esbuild. `react`/`react-dom` stay as external imports
 * (transform is single-file, it does not bundle), so the mounting sandbox
 * resolves React via its import map. A syntax error makes esbuild throw — this
 * throw IS the zero-syntax-error guarantee: nothing that fails here can ship.
 *
 * We use `transformSync` deliberately: esbuild's async service reuses a
 * long-lived worker that can deadlock when the host process is itself driven by
 * esbuild (e.g. `tsx`). The synchronous path spawns per call, is rock-solid
 * across runtimes, and the transforms here are tiny, so blocking is negligible.
 */
export async function compileSource(source: string): Promise<CompileResult> {
  try {
    const result = transformSync(source, {
      loader: "tsx",
      jsx: "automatic",
      format: "esm",
      target: "es2020",
      minify: false,
      legalComments: "none",
    });
    return { ok: true, bundle: result.code, errors: [] };
  } catch (err) {
    const e = err as { errors?: Array<{ text: string; location?: { line: number } }>; message?: string };
    const errors = e.errors?.length
      ? e.errors.map((x) => (x.location ? `L${x.location.line}: ${x.text}` : x.text))
      : [e.message ?? String(err)];
    return { ok: false, errors };
  }
}
