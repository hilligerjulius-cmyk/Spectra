import type { MaterializeResult } from "@spectra/contracts";

/**
 * Content-addressed LRU. Keyed by the normalized intent + strategy, so a
 * repeated request re-materializes instantly without re-running the pipeline.
 */
class LruCache {
  private map = new Map<string, MaterializeResult>();
  constructor(private capacity = 200) {}

  get(key: string): MaterializeResult | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    // refresh recency
    this.map.delete(key);
    this.map.set(key, hit);
    return hit;
  }

  set(key: string, value: MaterializeResult): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }
}

export const materializeCache = new LruCache();

export function cacheKey(normalizedIntent: string, strategy: string): string {
  return strategy + "::" + normalizedIntent;
}
