"use client";

import { motion } from "framer-motion";
import { PhaseTicker } from "./PhaseTicker";
import type { PhaseEvent } from "@spectra/contracts";
import { stateSwap } from "@/lib/motion";

type PhaseEntry = Extract<PhaseEvent, { kind: "phase" }>;

/** The "thinking" theatre: the intent echoed above a live pipeline ticker. */
export function MaterializeStage({
  intent,
  phases,
  progress,
  onStop,
}: {
  intent: string;
  phases: PhaseEntry[];
  progress: number;
  onStop: () => void;
}) {
  return (
    <motion.div
      variants={stateSwap}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex flex-col items-center px-6 text-center"
    >
      <div className="mb-1.5 text-xs uppercase tracking-[0.28em] text-zinc-600">Materializing</div>
      <div className="mb-10 max-w-md text-xl font-medium text-zinc-200">“{intent}”</div>
      <PhaseTicker phases={phases} progress={progress} />
      <button
        onClick={onStop}
        aria-label="Stop materializing"
        className="mt-9 flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[13px] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-100"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
        Stop
      </button>
    </motion.div>
  );
}
