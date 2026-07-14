"use client";

import { useEffect, useRef, useState } from "react";

export const SUGGESTIONS = [
  "a kanban board",
  "a pomodoro focus timer",
  "a markdown notepad",
  "an analytics dashboard",
  "a pricing page",
  "a contact form",
  "a task list for today",
  "a calculator",
] as const;

/** Manages the intent input: ref, value, ⌘K focus, and rotating placeholder. */
export function useCommandBar(active: boolean) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // ⌘K / Ctrl+K focuses the bar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Rotate the placeholder suggestion while idle and unfocused.
  useEffect(() => {
    if (!active || value) return;
    const id = window.setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % SUGGESTIONS.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [active, value]);

  return {
    inputRef,
    value,
    setValue,
    placeholder: SUGGESTIONS[placeholderIndex] ?? SUGGESTIONS[0],
  };
}
