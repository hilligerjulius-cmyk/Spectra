"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MountSandbox } from "@spectra/sandbox";
import { findModel, type MaterializeResult } from "@spectra/contracts";
import { springs } from "@/lib/motion";

export function AppFrame({
  result,
  materializing,
  onMounted,
  onDismiss,
  onRegenerate,
}: {
  result: MaterializeResult;
  materializing: boolean;
  onMounted: () => void;
  onDismiss: () => void;
  onRegenerate: () => void;
}) {
  const { manifest, bundle } = result;
  const [faulted, setFaulted] = useState<string | null>(null);

  // Honest provenance: Spectra is the engine; when an LLM generated the app we
  // show which model (the user's own choice), else "Spectra Engine" (template).
  const engineLabel = manifest.model
    ? (findModel(manifest.model)?.label ?? manifest.model)
    : "Spectra Engine";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94, y: 16, filter: "blur(14px)" }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
      transition={springs.materialize}
      className="mx-auto w-full max-w-5xl px-4"
    >
      <div className="glass overflow-hidden rounded-3xl shadow-elevated">
        {/* chrome */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: manifest.tokens.accent, boxShadow: `0 0 10px ${manifest.tokens.accent}` }}
          />
          <span className="text-sm font-medium text-zinc-100">{manifest.name}</span>
          <span
            className="rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide"
            style={{
              borderColor: "rgba(124,92,255,0.35)",
              background: "rgba(124,92,255,0.08)",
              color: "#c4b5fd",
            }}
          >
            Spectra
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-wide text-zinc-500 sm:block">
            {engineLabel} · {manifest.archetype}
          </span>
          <span className="ml-auto hidden font-mono text-[11px] text-zinc-600 sm:block">
            {manifest.elapsedMs}ms{manifest.hash ? ` · ${manifest.hash.slice(0, 8)}` : ""}
          </span>
          <button
            onClick={onRegenerate}
            title="Regenerate"
            className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={onDismiss}
            title="Dismiss"
            className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* mounted app + morph overlay */}
        <div className="relative min-h-[320px] bg-abyss">
          {faulted ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="text-sm text-zinc-400">This materialization faulted at runtime.</div>
              <div className="max-w-md font-mono text-xs text-zinc-600">{faulted}</div>
              <button
                onClick={onRegenerate}
                className="rounded-xl px-4 py-2 text-sm font-medium text-black"
                style={{ background: manifest.tokens.accent }}
              >
                Regenerate
              </button>
            </div>
          ) : (
            <MountSandbox
              bundle={bundle}
              manifest={manifest}
              onMounted={onMounted}
              onError={(m) => setFaulted(m)}
              minHeight={320}
            />
          )}

          <AnimatePresence>
            {materializing && !faulted ? (
              <motion.div
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="pointer-events-none absolute inset-0 grid place-items-center"
                style={{ background: "var(--spectra-abyss)" }}
              >
                <motion.div
                  className="h-[2px] w-1/2 rounded-full"
                  style={{ background: "var(--spectra-gradient-prism)", backgroundSize: "200% 100%" }}
                  animate={{ backgroundPositionX: ["0%", "200%"], scaleX: [0.2, 1] }}
                  transition={{ duration: 1.1, ease: [0.7, 0, 0.2, 1], repeat: Infinity }}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-4 text-center font-mono text-[11px] text-zinc-600">
        press <span className="text-zinc-400">⌘K</span> or dismiss to materialize something new
      </div>
    </motion.div>
  );
}
