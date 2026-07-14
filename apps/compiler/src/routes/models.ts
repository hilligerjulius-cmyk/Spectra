import type { FastifyInstance } from "fastify";
import { config } from "../config";
import { modelsResponse } from "../engine";

/** GET /models — the models the canvas may offer, based on configured keys. */
export async function modelsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/models", async () => modelsResponse(config));
}
