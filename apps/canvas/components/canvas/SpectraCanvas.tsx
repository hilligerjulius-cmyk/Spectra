"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMaterialize } from "@/hooks/useMaterialize";
import { PrismField } from "@/components/fx/PrismField";
import { CursorGlow } from "@/components/fx/CursorGlow";
import { GrainOverlay } from "@/components/fx/GrainOverlay";
import { HeroState } from "./HeroState";
import { MaterializeStage } from "./MaterializeStage";
import { AppFrame } from "./AppFrame";
import { stateSwap } from "@/lib/motion";

export function SpectraCanvas() {
  const m = useMaterialize();
  const showingApp = m.status === "materializing" || m.status === "mounted";
  const intensity = m.status === "idle" ? 1 : m.status === "thinking" ? 1.35 : 1.7;

  // Escape / ⌘K returns from a mounted app to the canvas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showingApp) m.reset();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && showingApp) {
        e.preventDefault();
        m.reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showingApp, m]);

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center py-20">
      <PrismField intensity={intensity} />
      <CursorGlow />
      <GrainOverlay />

      <AnimatePresence>
        {showingApp ? (
          <motion.button
            key="brand"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={m.reset}
            className="fixed left-6 top-6 z-40 text-lg font-semibold tracking-tight text-zinc-300 transition-colors hover:text-white"
          >
            <span className="spectral-text">Spectra</span>
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {m.status === "idle" ? (
          <motion.div key="idle" variants={stateSwap} initial="initial" animate="animate" exit="exit" className="w-full">
            <HeroState onSubmit={m.run} />
          </motion.div>
        ) : m.status === "thinking" ? (
          <motion.div key="think" variants={stateSwap} initial="initial" animate="animate" exit="exit" className="w-full">
            <MaterializeStage intent={m.intent} phases={m.phases} progress={m.progress} />
          </motion.div>
        ) : showingApp && m.result ? (
          <motion.div key="app" className="w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: "blur(8px)" }}>
            <AppFrame
              result={m.result}
              materializing={m.status === "materializing"}
              onMounted={m.markMounted}
              onDismiss={m.reset}
              onRegenerate={() => m.run(m.intent)}
            />
          </motion.div>
        ) : m.status === "error" ? (
          <motion.div key="err" variants={stateSwap} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center gap-5 px-6 text-center">
            <div className="text-xs uppercase tracking-[0.28em] text-zinc-600">Materialization failed</div>
            <div className="max-w-md text-zinc-300">{m.error}</div>
            <button
              onClick={m.reset}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-black"
              style={{ background: "var(--spectra-gradient-signature)" }}
            >
              Back to canvas
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
