"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ModelInfo, ModelProvider, ModelTier } from "@spectra/contracts";

const TIER_DOT: Record<ModelTier, string> = {
  fast: "var(--spectra-cyan)",
  balanced: "var(--spectra-blue)",
  powerful: "var(--spectra-violet)",
  frontier: "var(--spectra-rose, #FF5C8A)",
};

const PROVIDER_LABEL: Record<ModelProvider, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
};

export function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: readonly ModelInfo[];
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  // No provider key configured → offline/templates mode.
  if (models.length === 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px] text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
        Templates · no API key
      </div>
    );
  }

  const current = models.find((m) => m.id === value) ?? models[0];
  const grouped = groupByProvider(models);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-zinc-300 transition-colors hover:border-white/20 hover:text-zinc-100"
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: TIER_DOT[current!.tier] }} />
        {current!.label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-zinc-500">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="glass absolute left-1/2 z-50 mt-2 w-72 -translate-x-1/2 rounded-2xl p-1.5 shadow-elevated"
          >
            {grouped.map(([provider, list]) => (
              <div key={provider} className="py-1">
                <div className="px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-600">
                  {PROVIDER_LABEL[provider]}
                </div>
                {list.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                    className={
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors " +
                      (m.id === current!.id ? "bg-white/[0.07]" : "hover:bg-white/[0.04]")
                    }
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TIER_DOT[m.tier] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-zinc-100">{m.label}</span>
                      <span className="block text-[11px] text-zinc-500">{m.blurb}</span>
                    </span>
                    {m.id === current!.id ? <span className="text-xs text-zinc-400">✓</span> : null}
                  </button>
                ))}
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function groupByProvider(models: readonly ModelInfo[]): Array<[ModelProvider, ModelInfo[]]> {
  const map = new Map<ModelProvider, ModelInfo[]>();
  for (const m of models) {
    const list = map.get(m.provider) ?? [];
    list.push(m);
    map.set(m.provider, list);
  }
  return [...map.entries()];
}
