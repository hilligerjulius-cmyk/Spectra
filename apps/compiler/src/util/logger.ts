/** Minimal structured logger (Fastify carries its own; this is for pipeline stages). */
const ts = () => new Date().toISOString();

export const log = {
  info: (msg: string, meta?: unknown) =>
    console.log(`[${ts()}] ${msg}${meta ? " " + JSON.stringify(meta) : ""}`),
  warn: (msg: string, meta?: unknown) =>
    console.warn(`[${ts()}] ⚠ ${msg}${meta ? " " + JSON.stringify(meta) : ""}`),
  error: (msg: string, meta?: unknown) =>
    console.error(`[${ts()}] ✖ ${msg}${meta ? " " + JSON.stringify(meta) : ""}`),
};
