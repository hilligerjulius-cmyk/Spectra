"use client";

import { useCallback, useRef, useState } from "react";
import type { MaterializeResult, PhaseEvent } from "@spectra/contracts";
import { materializeStream } from "@/lib/api-client";

export type CanvasStatus = "idle" | "thinking" | "materializing" | "mounted" | "error";

export interface MaterializeState {
  status: CanvasStatus;
  intent: string;
  phases: Extract<PhaseEvent, { kind: "phase" }>[];
  progress: number;
  result: MaterializeResult | null;
  error: string | null;
}

const INITIAL: MaterializeState = {
  status: "idle",
  intent: "",
  phases: [],
  progress: 0,
  result: null,
  error: null,
};

export function useMaterialize() {
  const [state, setState] = useState<MaterializeState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL);
  }, []);

  const markMounted = useCallback(() => {
    setState((s) => (s.status === "materializing" ? { ...s, status: "mounted" } : s));
  }, []);

  const run = useCallback(async (intent: string) => {
    const trimmed = intent.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ ...INITIAL, status: "thinking", intent: trimmed });

    try {
      await materializeStream(
        { intent: trimmed },
        {
          signal: controller.signal,
          onEvent: (event) => {
            if (event.kind === "phase") {
              setState((s) => ({
                ...s,
                phases: [...s.phases, event],
                progress: Math.max(s.progress, event.progress),
              }));
            } else if (event.kind === "done") {
              setState((s) => ({
                ...s,
                status: "materializing",
                progress: 1,
                result: event.result,
              }));
              // Safety net: if the sandbox never reports mounted (e.g. its CDN
              // is blocked), resolve the morph anyway so the frame appears.
              window.setTimeout(() => {
                setState((s) => (s.status === "materializing" ? { ...s, status: "mounted" } : s));
              }, 1400);
            } else if (event.kind === "error") {
              setState((s) => ({ ...s, status: "error", error: event.message }));
            }
          },
        },
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((s) => ({ ...s, status: "error", error: (err as Error).message }));
    }
  }, []);

  return { ...state, run, reset, markMounted };
}
