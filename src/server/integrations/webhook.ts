import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withOrg } from "@/server/db/client";
import { integration } from "@/server/db/schema";
import { recordAudit } from "@/server/audit";
import { env } from "@/lib/env";
import {
  decryptSecret,
  encryptSecret,
  generateWebhookSecret,
  maskSecret,
  verifyWebhookSignature,
  WEBHOOK_TOLERANCE_SECONDS,
} from "./crypto";

/**
 * Generischer Webhook-Connector.
 *
 * Damit lassen sich Fremdsysteme anbinden, für die es keinen fertigen
 * Connector gibt: Das System sendet signierte Ereignisse an
 * `/api/webhooks/<organizationId>`, die Plattform prüft die Signatur und legt
 * daraus einen Vorgang an.
 *
 * Sicherheitsentscheidungen:
 *  - Das Signaturgeheimnis liegt AES-256-GCM-verschlüsselt in der Datenbank.
 *  - Signaturprüfung mit Zeitstempel (Replay-Schutz) und konstanter Laufzeit.
 *  - Der Nutzlast wird nie vertraut: Sie wird als Daten behandelt, gegen ein
 *    Schema validiert und in der Größe begrenzt.
 */

export const WEBHOOK_CONNECTOR_KEY = "webhook";
export const MAX_PAYLOAD_BYTES = 64 * 1024;

/** Vom Fremdsystem erwartete Nutzlast. */
export const webhookPayloadSchema = z.object({
  /** Fachlicher Ereignistyp, z. B. "task.created" oder "invoice.received". */
  event: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  dueAt: z.string().max(40).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  /** Freie Zusatzdaten des Fremdsystems. */
  data: z.record(z.string(), z.unknown()).optional(),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

interface WebhookConfig {
  secretEncrypted?: string;
  createdAt?: string;
  lastEventAt?: string;
  eventCount?: number;
}

export interface WebhookSetup {
  url: string;
  /** Nur direkt nach dem Erzeugen im Klartext — danach nie wieder. */
  secret?: string;
  secretMasked: string | null;
  toleranceSeconds: number;
  eventCount: number;
  lastEventAt: string | null;
}

export function webhookUrl(organizationId: string): string {
  return `${env.APP_URL}/api/webhooks/${organizationId}`;
}

/**
 * Richtet den Webhook ein und erzeugt ein neues Geheimnis.
 * Ein erneuter Aufruf ersetzt das bisherige Geheimnis — bestehende Sender
 * müssen dann umgestellt werden. Darauf weist die Oberfläche hin.
 */
export async function rotateWebhookSecret(params: {
  organizationId: string;
  userId: string;
  userLabel: string;
}): Promise<WebhookSetup> {
  const secret = generateWebhookSecret();
  const config: WebhookConfig = {
    secretEncrypted: encryptSecret(secret),
    createdAt: new Date().toISOString(),
    eventCount: 0,
  };

  await withOrg(params.organizationId, (tx) =>
    tx
      .insert(integration)
      .values({
        organizationId: params.organizationId,
        connectorKey: WEBHOOK_CONNECTOR_KEY,
        status: "connected",
        displayName: "Webhook (generisch)",
        config: config as Record<string, unknown>,
        connectedByUserId: params.userId,
      })
      .onConflictDoUpdate({
        target: [integration.organizationId, integration.connectorKey],
        set: {
          status: "connected",
          config: config as Record<string, unknown>,
          error: null,
        },
      }),
  );

  await recordAudit({
    organizationId: params.organizationId,
    actorType: "user",
    actorId: params.userId,
    actorLabel: params.userLabel,
    action: "integration.webhook_secret_rotated",
    targetType: "integration",
    targetId: WEBHOOK_CONNECTOR_KEY,
    summary:
      "Webhook-Signaturgeheimnis neu erzeugt. Zuvor eingerichtete Sender müssen umgestellt werden.",
  });

  return {
    url: webhookUrl(params.organizationId),
    secret,
    secretMasked: maskSecret(secret),
    toleranceSeconds: WEBHOOK_TOLERANCE_SECONDS,
    eventCount: 0,
    lastEventAt: null,
  };
}

export async function getWebhookSetup(
  organizationId: string,
): Promise<WebhookSetup | null> {
  const [row] = await withOrg(organizationId, (tx) =>
    tx
      .select()
      .from(integration)
      .where(eq(integration.connectorKey, WEBHOOK_CONNECTOR_KEY)),
  );
  if (!row || row.status !== "connected") return null;
  const config = row.config as WebhookConfig;
  if (!config.secretEncrypted) return null;

  // Für die Anzeige wird nur eine Maske berechnet, nie der Klartext geliefert.
  let masked: string | null = null;
  try {
    masked = maskSecret(decryptSecret(config.secretEncrypted));
  } catch {
    masked = null;
  }

  return {
    url: webhookUrl(organizationId),
    secretMasked: masked,
    toleranceSeconds: WEBHOOK_TOLERANCE_SECONDS,
    eventCount: config.eventCount ?? 0,
    lastEventAt: config.lastEventAt ?? null,
  };
}

export interface WebhookResult {
  status: number;
  body: { ok: boolean; message: string; taskId?: string };
}

/**
 * Verarbeitet einen eingehenden Webhook-Aufruf.
 * Gibt bewusst nur grobe Fehlermeldungen zurück — eine detaillierte Auskunft
 * darüber, warum eine Signatur nicht passt, hilft nur einem Angreifer.
 */
export async function handleWebhook(params: {
  organizationId: string;
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
}): Promise<WebhookResult> {
  if (Buffer.byteLength(params.rawBody, "utf8") > MAX_PAYLOAD_BYTES) {
    return {
      status: 413,
      body: { ok: false, message: "Nutzlast zu groß." },
    };
  }
  if (!params.signature || !params.timestamp) {
    return {
      status: 401,
      body: {
        ok: false,
        message:
          "Signatur fehlt. Erforderlich sind die Kopfzeilen X-Workforce-Signature und X-Workforce-Timestamp.",
      },
    };
  }

  const [row] = await withOrg(params.organizationId, (tx) =>
    tx
      .select()
      .from(integration)
      .where(eq(integration.connectorKey, WEBHOOK_CONNECTOR_KEY)),
  );
  const config = (row?.config ?? {}) as WebhookConfig;
  if (!row || row.status !== "connected" || !config.secretEncrypted) {
    return {
      status: 404,
      body: { ok: false, message: "Kein aktiver Webhook für diese Organisation." },
    };
  }

  let secret: string;
  try {
    secret = decryptSecret(config.secretEncrypted);
  } catch {
    return {
      status: 500,
      body: {
        ok: false,
        message:
          "Das hinterlegte Signaturgeheimnis kann nicht gelesen werden. Bitte in den Integrationen neu erzeugen.",
      },
    };
  }

  const check = verifyWebhookSignature({
    secret,
    timestamp: params.timestamp,
    body: params.rawBody,
    signature: params.signature,
  });
  if (!check.valid) {
    await recordAudit({
      organizationId: params.organizationId,
      actorType: "system",
      actorLabel: "Webhook",
      action: "integration.webhook_rejected",
      targetType: "integration",
      targetId: WEBHOOK_CONNECTOR_KEY,
      summary: `Webhook-Aufruf abgewiesen: ${check.reason}`,
    });
    return {
      status: 401,
      body: { ok: false, message: "Signaturprüfung fehlgeschlagen." },
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(params.rawBody);
  } catch {
    return { status: 400, body: { ok: false, message: "Kein gültiges JSON." } };
  }

  const parsed = webhookPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        ok: false,
        message: `Nutzlast entspricht nicht dem erwarteten Format: ${parsed.error.issues
          .map((i) => `${i.path.join(".")} ${i.message}`)
          .join("; ")}`,
      },
    };
  }

  const payload = parsed.data;
  const dueAt = payload.dueAt ? new Date(payload.dueAt) : null;

  const { task } = await import("@/server/db/schema");
  const [created] = await withOrg(params.organizationId, (tx) =>
    tx
      .insert(task)
      .values({
        organizationId: params.organizationId,
        title: payload.title,
        description: payload.description ?? null,
        dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
        priority: payload.priority,
        status: "open",
        createdByType: "system",
        // Inhalte des Fremdsystems bleiben Daten — sie werden nirgends als
        // Anweisung ausgewertet.
        source: {
          connector: WEBHOOK_CONNECTOR_KEY,
          event: payload.event,
          data: payload.data ?? {},
        },
      })
      .returning({ id: task.id }),
  );

  await withOrg(params.organizationId, (tx) =>
    tx
      .update(integration)
      .set({
        lastSyncAt: new Date(),
        config: {
          ...config,
          lastEventAt: new Date().toISOString(),
          eventCount: (config.eventCount ?? 0) + 1,
        } as Record<string, unknown>,
      })
      .where(eq(integration.connectorKey, WEBHOOK_CONNECTOR_KEY)),
  );

  await recordAudit({
    organizationId: params.organizationId,
    actorType: "system",
    actorLabel: "Webhook",
    action: "integration.webhook_received",
    targetType: "task",
    targetId: created!.id,
    summary: `Webhook-Ereignis "${payload.event}" angenommen und als Aufgabe angelegt.`,
    metadata: { event: payload.event },
  });

  return {
    status: 202,
    body: { ok: true, message: "Ereignis angenommen.", taskId: created!.id },
  };
}
