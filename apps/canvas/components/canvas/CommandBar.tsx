"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useCommandBar } from "@/hooks/useCommandBar";
import { Kbd } from "@/components/ui/Kbd";
import { springs } from "@/lib/motion";

export function CommandBar({
  onSubmit,
  active = true,
}: {
  onSubmit: (intent: string) => void;
  active?: boolean;
}) {
  const { inputRef, value, setValue, placeholder } = useCommandBar(active);
  const [focused, setFocused] = useState(false);

  const submit = () => {
    const v = value.trim();
    if (v) onSubmit(v);
  };

  return (
    <motion.div
      layout
      transition={springs.base}
      className="glass relative flex w-full items-center gap-3 rounded-2xl px-4 py-3.5"
      style={{
        boxShadow: focused
          ? "0 0 0 1px rgba(124,92,255,0.35), 0 18px 60px -18px rgba(124,92,255,0.5)"
          : "0 12px 40px -16px rgba(0,0,0,0.7)",
        transition: "box-shadow 0.35s ease",
      }}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: "var(--spectra-gradient-signature)", boxShadow: "0 0 12px rgba(124,92,255,0.8)" }}
      />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={active ? `Try “${placeholder}”…` : "Describe anything…"}
        aria-label="Describe the application to materialize"
        className="flex-1 bg-transparent text-[15px] text-zinc-100 outline-none placeholder:text-zinc-600"
        autoFocus
      />
      <Kbd>⌘K</Kbd>
      <button
        onClick={submit}
        aria-label="Materialize"
        className="grid h-8 w-8 place-items-center rounded-xl text-black transition-transform hover:scale-105 active:scale-95"
        style={{ background: value.trim() ? "var(--spectra-gradient-signature)" : "rgba(255,255,255,0.1)" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </motion.div>
  );
}
