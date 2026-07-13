import type { AppManifest } from "@spectra/contracts";
import { FRAME_SOURCE, PARENT_SOURCE, type FrameMessage } from "./types";

/** Type-guard + shape validation for messages arriving from the frame. */
export function parseFrameMessage(data: unknown): FrameMessage | null {
  if (!data || typeof data !== "object") return null;
  const m = data as Record<string, unknown>;
  if (m.source !== FRAME_SOURCE) return null;
  switch (m.type) {
    case "ready":
    case "mounted":
      return { source: FRAME_SOURCE, type: m.type };
    case "error":
      return {
        source: FRAME_SOURCE,
        type: "error",
        message: typeof m.message === "string" ? m.message : "Unknown error",
        stack: typeof m.stack === "string" ? m.stack : undefined,
      };
    case "resize":
      return {
        source: FRAME_SOURCE,
        type: "resize",
        height: typeof m.height === "number" ? m.height : 0,
      };
    default:
      return null;
  }
}

/**
 * Post a compiled bundle to the frame for mounting. A sandboxed, null-origin
 * frame can only be targeted with "*"; safety comes from the shape-validated
 * protocol and the frame's own isolation, not from origin pinning.
 */
export function postMount(
  frame: Window,
  bundle: string,
  manifest: AppManifest,
): void {
  frame.postMessage({ source: PARENT_SOURCE, type: "mount", bundle, manifest }, "*");
}
