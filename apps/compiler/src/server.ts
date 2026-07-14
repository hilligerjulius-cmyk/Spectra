import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { config } from "./config";
import { healthRoutes } from "./routes/health";
import { materializeRoutes } from "./routes/materialize";
import { modelsRoutes } from "./routes/models";
import { log } from "./util/logger";

/** Build (but do not start) the Fastify app — used by both `main` and tests. */
export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, bodyLimit: 1_000_000 });
  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
  });
  await app.register(healthRoutes);
  await app.register(modelsRoutes);
  await app.register(materializeRoutes);
  return app;
}

async function main(): Promise<void> {
  const app = await buildServer();
  try {
    await app.listen({ port: config.port, host: config.host });
    log.info(`Spectra Compiler Engine listening on http://${config.host}:${config.port}`, {
      llmEnabled: config.llmEnabled,
      providers: config.providers,
      defaultModel: config.defaultModel,
    });
  } catch (err) {
    log.error("Failed to start Compiler Engine", { err: String(err) });
    process.exit(1);
  }
}

// Only auto-start when executed directly (not when imported by tests).
const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntry) {
  void main();
}
