"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMaterialize } from "@/hooks/useMaterialize";
import { useModels } from "@/hooks/useModels";
import { useHistory, type HistoryEntry } from "@/hooks/useHistory";
import { PrismField } from "@/components/fx/PrismField";
import { CursorGlow } from "@/components/fx/CursorGlow";
import { GrainOverlay } from "@/components/fx/GrainOverlay";
import { HeroState } from "./HeroState";
import { MaterializeStage } from "./MaterializeStage";
import { AppFrame } from "./AppFrame";
import { HistoryRail, HistoryToggle } from "./HistoryRail";
import { stateSwap } from "@/lib/motion";

export function SpectraCanvas() {
  const m = useMaterialize();
  const models = useModels();
  const history = useHistory();
  const [model, setModel] = useState<string | undefined>(undefined);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Set when the user explicitly picked a past result from the rail. Takes
  // rendering priority over the live `m` state, so you can browse old
  // materializations without touching (or losing) the current run.
  const [historyView, setHistoryView] = useState<HistoryEntry | null>(null);
  const recordedHash = useRef<string | null>(null);

  const showingLiveApp = !historyView && (m.status === "materializing" || m.status === "mounted");
  const showingApp = historyView !== null || showingLiveApp;
  const activeResult = historyView ? historyView.result : m.result;
  const intensity = m.status === "idle" ? 1 : m.status === "thinking" ? 1.35 : 1.7;

  // Adopt the server's default model once the catalog loads.
  useEffect(() => {
    if (!model && models.defaultModel) setModel(models.defaultModel);
  }, [models.defaultModel, model]);

  // Every completed live materialization is recorded to history, once.
  useEffect(() => {
    if (m.status === "mounted" && m.result && recordedHash.current !== m.result.manifest.hash) {
      recordedHash.current = m.result.manifest.hash;
      history.add(m.intent, m.result);
    }
  }, [m.status, m.result, m.intent, history]);

  const goHome = useCallback(() => {
    setHistoryView(null);
    m.reset();
  }, [m]);

  const handleSubmit = useCallback(
    (intent: string) => {
      setHistoryView(null);
      m.run(intent, model);
    },
    [m, model],
  );

  const handleSelectHistory = useCallback(
    (entry: HistoryEntry) => {
      m.reset();
      setHistoryView(entry);
      setHistoryOpen(false);
    },
    [m],
  );

  const handleRegenerate = useCallback(() => {
    const intent = historyView ? historyView.intent : m.intent;
    setHistoryView(null);
    m.run(intent, model);
  }, [historyView, m, model]);

  // Escape closes the history rail first, then returns from an app to canvas.
  // ⌘K always jumps back to canvas from an app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (historyOpen) {
          setHistoryOpen(false);
          return;
        }
        if (showingApp) goHome();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && showingApp) {
        e.preventDefault();
        goHome();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showingApp, historyOpen, goHome]);

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center py-20">
      <PrismField intensity={intensity} />
      <CursorGlow />
      <GrainOverlay />

      <HistoryToggle open={historyOpen} onToggle={() => setHistoryOpen((o) => !o)} />
      <HistoryRail
        open={historyOpen}
        entries={history.entries}
        activeId={historyView?.id ?? null}
        onSelect={handleSelectHistory}
        onRemove={history.remove}
        onNew={goHome}
      />

      <AnimatePresence>
        {showingApp ? (
          <motion.button
            key="brand"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={goHome}
            className="fixed left-16 top-6 z-40 text-lg font-semibold tracking-tight text-zinc-300 transition-colors hover:text-white"
          >
            <span className="spectral-text">Spectra</span>
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {m.status === "idle" && !historyView ? (
          <motion.div key="idle" variants={stateSwap} initial="initial" animate="animate" exit="exit" className="w-full">
            <HeroState onSubmit={handleSubmit} models={models.available} model={model} onModel={setModel} />
          </motion.div>
        ) : m.status === "thinking" ? (
          <motion.div key="think" variants={stateSwap} initial="initial" animate="animate" exit="exit" className="w-full">
            <MaterializeStage intent={m.intent} phases={m.phases} progress={m.progress} onStop={m.stop} />
          </motion.div>
        ) : showingApp && activeResult ? (
          <motion.div key="app" className="w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: "blur(8px)" }}>
            <AppFrame
              result={activeResult}
              materializing={showingLiveApp && m.status === "materializing"}
              onMounted={m.markMounted}
              onDismiss={goHome}
              onRegenerate={handleRegenerate}
            />
          </motion.div>
        ) : m.status === "error" ? (
          <motion.div key="err" variants={stateSwap} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center gap-5 px-6 text-center">
            <div className="text-xs uppercase tracking-[0.28em] text-zinc-600">Materialization failed</div>
            <div className="max-w-md text-zinc-300">{m.error}</div>
            <button
              onClick={goHome}
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
