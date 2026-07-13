import * as React from "react";
import type { AppManifest } from "@spectra/contracts";
import { buildSrcDoc } from "./srcdoc";
import { IFRAME_SANDBOX } from "./policy";
import { parseFrameMessage, postMount } from "./bridge";
import type { FrameStatus, SandboxCallbacks } from "./types";

export interface MountSandboxProps extends SandboxCallbacks {
  /** Compiled ESM bundle (react external). When null, nothing is mounted yet. */
  bundle: string | null;
  /** Manifest that accompanies the bundle. */
  manifest: AppManifest | null;
  /** Optional className for the wrapper. */
  className?: string;
  /** Minimum frame height in px while content settles. */
  minHeight?: number;
  /** Auto-grow the iframe to reported content height. Default true. */
  autoResize?: boolean;
}

/**
 * MountSandbox — renders the isolated iframe and drives its lifecycle. The
 * srcdoc is built once (stable identity); bundles are streamed in via
 * postMessage as the `bundle` prop changes.
 */
export function MountSandbox({
  bundle,
  manifest,
  className,
  minHeight = 320,
  autoResize = true,
  onReady,
  onMounted,
  onError,
  onResize,
}: MountSandboxProps) {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const readyRef = React.useRef(false);
  const pendingRef = React.useRef<{ bundle: string; manifest: AppManifest } | null>(null);
  const [status, setStatus] = React.useState<FrameStatus>("idle");
  const [height, setHeight] = React.useState(minHeight);

  const srcDoc = React.useMemo(() => buildSrcDoc(), []);

  // Keep the latest callbacks without re-subscribing the message listener.
  const cbs = React.useRef<SandboxCallbacks>({});
  cbs.current = { onReady, onMounted, onError, onResize };

  const flush = React.useCallback(() => {
    const frame = frameRef.current?.contentWindow;
    const payload = pendingRef.current;
    if (frame && readyRef.current && payload) {
      postMount(frame, payload.bundle, payload.manifest);
      pendingRef.current = null;
      setStatus("loading");
    }
  }, []);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const msg = parseFrameMessage(event.data);
      if (!msg) return;
      switch (msg.type) {
        case "ready":
          readyRef.current = true;
          setStatus("ready");
          cbs.current.onReady?.();
          flush();
          break;
        case "mounted":
          setStatus("mounted");
          cbs.current.onMounted?.();
          break;
        case "error":
          setStatus("error");
          cbs.current.onError?.(msg.message, msg.stack);
          break;
        case "resize":
          if (autoResize && msg.height > 0) {
            setHeight(Math.max(minHeight, msg.height));
            cbs.current.onResize?.(msg.height);
          }
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [autoResize, minHeight, flush]);

  // Queue a mount whenever a new bundle arrives.
  React.useEffect(() => {
    if (bundle && manifest) {
      pendingRef.current = { bundle, manifest };
      flush();
    }
  }, [bundle, manifest, flush]);

  return (
    <iframe
      ref={frameRef}
      title={manifest?.name ?? "Spectra materialization"}
      sandbox={IFRAME_SANDBOX}
      srcDoc={srcDoc}
      onLoad={() => {
        // A fresh document invalidates prior readiness.
        readyRef.current = false;
      }}
      className={className}
      data-status={status}
      style={{
        width: "100%",
        height: autoResize ? height : "100%",
        border: "0",
        display: "block",
        colorScheme: "dark",
        background: "transparent",
      }}
    />
  );
}
