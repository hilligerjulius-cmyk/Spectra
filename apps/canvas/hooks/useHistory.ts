"use client";

import { useCallback, useEffect, useState } from "react";
import type { MaterializeResult } from "@spectra/contracts";

export interface HistoryEntry {
  /** = manifest.hash — stable id for dedupe. */
  id: string;
  intent: string;
  result: MaterializeResult;
  createdAt: number;
}

const STORAGE_KEY = "spectra:history";
const MAX_ENTRIES = 24;

function load(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function save(entries: HistoryEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable or full — history just won't persist across reloads */
  }
}

/** Past materializations, newest first, persisted in localStorage. */
export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  // Hydrate from localStorage after mount (avoids SSR/client mismatch).
  useEffect(() => {
    setEntries(load());
  }, []);

  const add = useCallback((intent: string, result: MaterializeResult) => {
    setEntries((prev) => {
      const id = result.manifest.hash;
      const next = [{ id, intent, result, createdAt: Date.now() }, ...prev.filter((e) => e.id !== id)].slice(
        0,
        MAX_ENTRIES,
      );
      save(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      save(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    save([]);
  }, []);

  return { entries, add, remove, clear };
}
