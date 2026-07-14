"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { HistoryEntry } from "@/hooks/useHistory";

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function HistoryToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={open ? "Close history" : "Open history"}
      aria-expanded={open}
      className="fixed left-4 top-5 z-50 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 backdrop-blur transition-colors hover:border-white/20 hover:text-zinc-100"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function HistoryRail({
  open,
  entries,
  activeId,
  onSelect,
  onRemove,
  onNew,
}: {
  open: boolean;
  entries: readonly HistoryEntry[];
  activeId: string | null;
  onSelect: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="glass fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/[0.07] pt-16 shadow-elevated"
        >
          <div className="flex items-center justify-between px-4 pb-3">
            <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">History</span>
            <button
              onClick={onNew}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[12px] text-zinc-300 transition-colors hover:border-white/20 hover:text-zinc-100"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              New
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {entries.length === 0 ? (
              <div className="px-3 py-8 text-center text-[13px] text-zinc-600">
                Nothing materialized yet.
                <br />
                Your history will appear here.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {entries.map((entry) => {
                  const active = entry.id === activeId;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => onSelect(entry)}
                      className={
                        "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors " +
                        (active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]")
                      }
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: entry.result.manifest.tokens.accent }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-zinc-200">
                          {entry.result.manifest.name}
                        </span>
                        <span className="block text-[11px] text-zinc-600">{relativeTime(entry.createdAt)}</span>
                      </span>
                      <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(entry.id);
                        }}
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-zinc-600 opacity-0 transition-opacity hover:text-zinc-200 group-hover:opacity-100"
                        aria-label="Remove from history"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                        </svg>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
