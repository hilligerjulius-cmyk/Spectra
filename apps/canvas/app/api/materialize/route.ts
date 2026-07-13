import type { NextRequest } from "next/server";
import type { MaterializeRequest, PhaseEvent } from "@spectra/contracts";
import { materialize, loadConfig } from "@spectra/compiler/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Materialization endpoint.
 *
 * Default (single-service deploy): runs the Compiler Engine **in-process** and
 * streams its phase events as SSE. Set `COMPILER_URL` to instead proxy to a
 * standalone Fastify compiler (two-service topology) — the wire format is
 * identical, so the canvas doesn't care which mode is active.
 */
const COMPILER_URL = process.env.COMPILER_URL;
const engineConfig = loadConfig();

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;

export async function POST(req: NextRequest): Promise<Response> {
  const bodyText = await req.text();
  let body: Partial<MaterializeRequest> = {};
  try {
    body = JSON.parse(bodyText || "{}");
  } catch {
    body = {};
  }
  const intent = typeof body.intent === "string" ? body.intent.trim() : "";
  if (!intent) {
    return Response.json({ error: "Field 'intent' is required." }, { status: 400 });
  }

  // ── Two-service mode: proxy the SSE stream from the Fastify compiler ──
  if (COMPILER_URL) {
    try {
      const upstream = await fetch(`${COMPILER_URL}/materialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyText,
        // @ts-expect-error — Node fetch streaming duplex flag
        duplex: "half",
      });
      if (!upstream.body) {
        return Response.json({ error: "Empty response from Compiler Engine" }, { status: 502 });
      }
      return new Response(upstream.body, { status: upstream.status, headers: SSE_HEADERS });
    } catch {
      return Response.json(
        { error: `Compiler Engine unreachable at ${COMPILER_URL}` },
        { status: 502 },
      );
    }
  }

  // ── Single-service mode: run the pipeline in-process ──
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: PhaseEvent) => {
        try {
          controller.enqueue(encoder.encode(`event: spectra\ndata: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* stream already closed */
        }
      };
      controller.enqueue(encoder.encode(": spectra stream open\n\n"));
      try {
        await materialize({ intent, options: body.options }, engineConfig, send);
      } catch (err) {
        send({ kind: "error", message: (err as Error).message ?? "Materialization failed", at: Date.now() });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
