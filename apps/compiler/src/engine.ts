/**
 * Library entry point for the Compiler Engine.
 *
 * Exposes the pipeline as an importable function so the Spectra Canvas can run
 * generation **in-process** (single-service deploy) without the Fastify HTTP
 * layer. The standalone Fastify server (`server.ts`) remains fully usable for a
 * two-service topology; both share this exact same orchestrator.
 */
import type { ModelsResponse } from "@spectra/contracts";
import { config as defaultConfig, type Config } from "./config";

export { materialize } from "./pipeline/orchestrator";
export { loadConfig, config } from "./config";
export type { Config } from "./config";
export { ARCHETYPES } from "./generators/deterministic/registry";

/** Which models the canvas may offer, given the server's configured keys. */
export function modelsResponse(cfg: Config = defaultConfig): ModelsResponse {
  return {
    available: cfg.availableModels,
    defaultModel: cfg.defaultModel,
    providers: cfg.providers,
  };
}
