import { modelsResponse } from "@spectra/compiler/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPILER_URL = process.env.COMPILER_URL;

/** GET /api/models — which models the UI may offer (based on configured keys). */
export async function GET(): Promise<Response> {
  if (COMPILER_URL) {
    try {
      const upstream = await fetch(`${COMPILER_URL}/models`);
      return Response.json(await upstream.json());
    } catch {
      return Response.json({ available: [], defaultModel: null, providers: [] });
    }
  }
  return Response.json(modelsResponse());
}
