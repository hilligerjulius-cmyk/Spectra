import { createHash } from "node:crypto";
import { env, providerStatus } from "@/lib/env";

/**
 * Embedding-Abstraktion.
 * - VoyageProvider: echte semantische Embeddings (VOYAGE_API_KEY nötig).
 * - LocalEmbeddingProvider: deterministisches Hashing-TF-Embedding (1024-dim)
 *   als Demo-Fallback — bewusst einfach, im UI als eingeschränkt gekennzeichnet.
 * Beide liefern 1024 Dimensionen (Spaltentyp vector(1024)).
 */

export const EMBEDDING_DIM = 1024;

export interface EmbeddingProvider {
  readonly name: string;
  readonly isReal: boolean;
  embed(texts: string[]): Promise<number[][]>;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/** Zeichen-Trigramme eines Tokens (mit Randmarkierung). */
function trigrams(token: string): string[] {
  const padded = `_${token}_`;
  const grams: string[] = [];
  for (let i = 0; i + 3 <= padded.length; i++) {
    grams.push(padded.slice(i, i + 3));
  }
  return grams;
}

/**
 * Deterministisches Hashing-Embedding aus ganzen Tokens und Zeichen-Trigrammen.
 *
 * Die Trigramme sind entscheidend für den deutschen Sprachraum: ohne sie
 * hätten „Kündigungsfrist" und „Kündigungsfristen" keinerlei Überlappung, weil
 * reines Token-Hashing keine Wortformen kennt. Mit Trigrammen teilen sich
 * beide Formen fast alle Merkmale.
 *
 * Bleibt bewusst ein Näherungsverfahren ohne Sprachverständnis — echte
 * Semantik (Synonyme, Umschreibungen) liefert erst ein Embedding-Modell.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local";
  readonly isReal = false;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vec = new Array<number>(EMBEDDING_DIM).fill(0);

      const add = (feature: string, weight: number) => {
        const hash = createHash("md5").update(feature).digest();
        const bucket = hash.readUInt32BE(0) % EMBEDDING_DIM;
        const bucket2 = hash.readUInt32BE(4) % EMBEDDING_DIM;
        const sign = hash[8]! % 2 === 0 ? 1 : -1;
        vec[bucket] = (vec[bucket] ?? 0) + weight;
        vec[bucket2] = (vec[bucket2] ?? 0) + sign * weight * 0.5;
      };

      for (const token of tokenize(text)) {
        // Ganzes Token stärker gewichten als einzelne Trigramme
        add(`w:${token}`, 1);
        for (const gram of trigrams(token)) {
          add(`g:${gram}`, 0.35);
        }
      }

      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
      return vec.map((v) => v / norm);
    });
  }
}

/** Voyage AI (voyage-3.5) — von Anthropic empfohlener Embedding-Anbieter. */
export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly name = "voyage";
  readonly isReal = true;

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "voyage-3.5",
        input: texts,
        output_dimension: EMBEDDING_DIM,
      }),
    });
    if (!res.ok) {
      throw new Error(`Voyage-Embedding fehlgeschlagen: HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
    };
    return json.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }
}

let cached: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (!cached) {
    cached = providerStatus.voyage
      ? new VoyageEmbeddingProvider()
      : new LocalEmbeddingProvider();
  }
  return cached;
}
