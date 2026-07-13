import type { FastifyInstance } from "fastify";
import { config } from "../config";
import { materializeCache } from "../cache/store";
import { ARCHETYPES } from "../generators/deterministic/registry";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({
    status: "ok",
    strategy: config.strategy,
    llmEnabled: config.llmEnabled,
    archetypes: ARCHETYPES,
    cacheSize: materializeCache.size,
  }));
}
