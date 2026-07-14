"use client";

import { useEffect, useState } from "react";
import type { ModelsResponse } from "@spectra/contracts";

const EMPTY: ModelsResponse = { available: [], defaultModel: null, providers: [] };

/** Fetch the models the server can actually use (given its configured keys). */
export function useModels(): ModelsResponse {
  const [data, setData] = useState<ModelsResponse>(EMPTY);
  useEffect(() => {
    let alive = true;
    fetch("/api/models")
      .then((r) => r.json())
      .then((d: ModelsResponse) => {
        if (alive) setData(d);
      })
      .catch(() => {
        /* offline → templates */
      });
    return () => {
      alive = false;
    };
  }, []);
  return data;
}
