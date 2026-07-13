"use client";

import { motion } from "framer-motion";
import { CommandBar } from "./CommandBar";
import { ChromaticText } from "@/components/fx/ChromaticText";
import { SUGGESTIONS } from "@/hooks/useCommandBar";
import { stagger, riseItem } from "@/lib/motion";

const CHIPS = SUGGESTIONS.slice(0, 5);

export function HeroState({ onSubmit }: { onSubmit: (intent: string) => void }) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 text-center"
    >
      <motion.div variants={riseItem} className="mb-6 flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-zinc-500">
        <span className="h-px w-6 bg-gradient-to-r from-transparent to-white/30" />
        Zero-Interface Software
        <span className="h-px w-6 bg-gradient-to-l from-transparent to-white/30" />
      </motion.div>

      <motion.h1
        variants={riseItem}
        className="text-[clamp(3.5rem,10vw,7rem)] font-semibold leading-none tracking-tight"
      >
        <ChromaticText text="Spectra" />
      </motion.h1>

      <motion.p variants={riseItem} className="mt-5 max-w-md text-balance text-[17px] leading-relaxed text-zinc-400">
        Describe anything. Watch it materialize into a living application — in milliseconds.
      </motion.p>

      <motion.div variants={riseItem} className="mt-9 w-full">
        <CommandBar onSubmit={onSubmit} active />
      </motion.div>

      <motion.div variants={riseItem} className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {CHIPS.map((s) => (
          <button
            key={s}
            onClick={() => onSubmit(s)}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[13px] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200"
          >
            {s}
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}
