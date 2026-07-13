"use client";

import { motion } from "framer-motion";
import { PHASE_ORDER, type PhaseEvent, type PhaseName, type PhaseStatus } from "@spectra/contracts";

const PHASE_LABEL: Record<PhaseName, string> = {
  ingest: "Ingest",
  generate: "Generate",
  validate: "Validate",
  compile: "Compile",
  repair: "Repair",
  package: "Package",
};

type PhaseEntry = Extract<PhaseEvent, { kind: "phase" }>;

function statusFor(phases: PhaseEntry[], phase: PhaseName): PhaseStatus | "pending" {
  const matches = phases.filter((p) => p.phase === phase);
  const last = matches[matches.length - 1];
  return last ? last.status : "pending";
}

const DOT: Record<PhaseStatus | "pending", string> = {
  pending: "rgba(255,255,255,0.14)",
  start: "var(--spectra-cyan)",
  ok: "var(--spectra-violet)",
  warn: "var(--spectra-warn, #F5C451)",
  error: "var(--spectra-error, #FF6B6B)",
};

export function PhaseTicker({ phases, progress }: { phases: PhaseEntry[]; progress: number }) {
  const current = phases[phases.length - 1];

  return (
    <div className="w-full max-w-sm">
      <div className="mb-4 flex items-center justify-between font-mono text-xs">
        <span className="text-zinc-400">{current?.label ?? "Initializing"}</span>
        <span className="tabular-nums text-zinc-600">{Math.round(progress * 100)}%</span>
      </div>

      <div className="mb-6 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--spectra-gradient-signature)" }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(progress * 100)}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <ul className="space-y-2.5">
        {PHASE_ORDER.map((phase) => {
          const st = statusFor(phases, phase);
          const active = current?.phase === phase && st === "start";
          return (
            <li key={phase} className="flex items-center gap-3 font-mono text-[13px]">
              <span
                className="h-2 w-2 rounded-full transition-colors duration-300"
                style={{
                  background: DOT[st],
                  boxShadow: st === "ok" || st === "start" ? `0 0 10px ${DOT[st]}` : "none",
                }}
              />
              <span className={st === "pending" ? "text-zinc-600" : "text-zinc-300"}>{PHASE_LABEL[phase]}</span>
              {active ? (
                <motion.span
                  className="ml-auto text-zinc-600"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  ···
                </motion.span>
              ) : st === "ok" ? (
                <span className="ml-auto text-zinc-600">✓</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
