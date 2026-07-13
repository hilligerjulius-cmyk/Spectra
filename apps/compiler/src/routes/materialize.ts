import type { FastifyInstance } from "fastify";
import type { MaterializeRequest, PhaseEvent } from "@spectra/contracts";
import { materialize } from "../pipeline/orchestrator";
import { config } from "../config";
import { formatSse } from "../util/sse";

/** POST /materialize — runs the pipeline and streams phase events over SSE. */
export async function materializeRoutes(app: FastifyInstance): Promise<void> {
  app.post("/materialize", async (request, reply) => {
    const body = request.body as Partial<MaterializeRequest> | undefined;
    const intent = body?.intent?.trim();

    if (!intent) {
      reply.code(400).send({ error: "Field 'intent' is required." });
      return;
    }

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    // Prime the stream so proxies flush immediately.
    raw.write(": spectra stream open\n\n");

    // Detect a genuine client disconnect via the RESPONSE stream. (Listening on
    // the request stream is wrong: its "close" fires as soon as the buffered
    // POST body is read, which would abort streaming immediately.)
    let aborted = false;
    raw.on("close", () => {
      if (!raw.writableFinished) aborted = true;
    });

    const send = (event: PhaseEvent) => {
      if (!aborted && !raw.writableEnded) raw.write(formatSse(event));
    };

    try {
      await materialize({ intent, options: body?.options }, config, send);
    } catch (err) {
      send({ kind: "error", message: (err as Error).message ?? "Materialization failed", at: Date.now() });
    } finally {
      if (!aborted && !raw.writableEnded) raw.end();
    }
  });
}
