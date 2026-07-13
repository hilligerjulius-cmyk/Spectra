import { createHash } from "node:crypto";

/** Short, stable content hash (first 16 hex chars of sha-256). */
export function contentHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}
