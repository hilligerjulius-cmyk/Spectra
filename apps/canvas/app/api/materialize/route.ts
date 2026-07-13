import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPILER_URL = process.env.COMPILER_URL ?? "http://localhost:4000";

/**
 * Same-origin proxy to the Compiler Engine. Streams the SSE response straight
 * back to the canvas so the browser never talks to the compiler cross-origin.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${COMPILER_URL}/materialize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // @ts-expect-error — Node fetch streaming duplex flag
      duplex: "half",
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Compiler Engine is unreachable. Is it running on " + COMPILER_URL + " ?" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!upstream.body) {
    return new Response(JSON.stringify({ error: "Empty response from Compiler Engine" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
