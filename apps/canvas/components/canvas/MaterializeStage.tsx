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
}: {
  intent: string;
  phases: PhaseEntry[];
  progress: number;
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
    </motion.div>
  );
}
