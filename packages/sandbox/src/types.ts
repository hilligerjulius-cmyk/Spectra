import type { AppManifest } from "@spectra/contracts";

/** Message envelopes exchanged across the iframe boundary. */

export const PARENT_SOURCE = "spectra-parent" as const;
export const FRAME_SOURCE = "spectra-frame" as const;

/** Parent → frame. */
export type ParentMessage = {
  readonly source: typeof PARENT_SOURCE;
  readonly type: "mount";
  readonly bundle: string;
  readonly manifest: AppManifest;
};

/** Frame → parent. */
export type FrameMessage =
  | { readonly source: typeof FRAME_SOURCE; readonly type: "ready" }
  | { readonly source: typeof FRAME_SOURCE; readonly type: "mounted" }
  | {
      readonly source: typeof FRAME_SOURCE;
      readonly type: "error";
      readonly message: string;
      readonly stack?: string;
    }
  | {
      readonly source: typeof FRAME_SOURCE;
      readonly type: "resize";
      readonly height: number;
    };

export type FrameStatus = "idle" | "loading" | "ready" | "mounted" | "error";

export interface SandboxCallbacks {
  onReady?: () => void;
  onMounted?: () => void;
  onError?: (message: string, stack?: string) => void;
  onResize?: (height: number) => void;
}
