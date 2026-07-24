import { NextResponse } from "next/server";
import { handleWebhook, MAX_PAYLOAD_BYTES } from "@/server/integrations/webhook";

/**
 * Eingang für signierte Ereignisse von Fremdsystemen.
 *
 * Die Route ist bewusst nicht sessiongeschützt — sie wird von Servern
 * aufgerufen, nicht von Browsern. Die Berechtigung ergibt sich allein aus der
 * HMAC-Signatur über Zeitstempel und Rohtext der Nutzlast.
 *
 * Erwartete Kopfzeilen:
 *   X-Workforce-Signature: <hex>   (HMAC-SHA256 über "<timestamp>.<body>")
 *   X-Workforce-Timestamp: <unix seconds>
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await params;

  // Rohtext lesen: Die Signatur gilt über exakt diese Bytes, nicht über ein
  // neu serialisiertes Objekt.
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, message: "Nutzlast zu groß." },
      { status: 413 },
    );
  }

  try {
    const result = await handleWebhook({
      organizationId,
      rawBody,
      signature: request.headers.get("x-workforce-signature"),
      timestamp: request.headers.get("x-workforce-timestamp"),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    // Interne Details bleiben im Log, nicht in der Antwort.
    console.error("Webhook-Verarbeitung fehlgeschlagen:", err);
    return NextResponse.json(
      { ok: false, message: "Verarbeitung fehlgeschlagen." },
      { status: 500 },
    );
  }
}

/** Andere Methoden ausdrücklich ablehnen. */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message:
        "Dieser Endpunkt nimmt ausschließlich signierte POST-Anfragen entgegen.",
    },
    { status: 405 },
  );
}
