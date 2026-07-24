"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requirePermission, PermissionError } from "@/server/auth/guards";
import { withOrg } from "@/server/db/client";
import { integration } from "@/server/db/schema";
import { recordAudit } from "@/server/audit";
import { getConnector, isConnectorAvailable } from "./registry";
import { seedDemoData, clearDemoData } from "@/server/demo/seed";

export interface IntegrationActionResult {
  ok: boolean;
  message: string;
}

function failure(err: unknown): IntegrationActionResult {
  if (err instanceof PermissionError) return { ok: false, message: err.message };
  console.error("Integration-Action fehlgeschlagen:", err);
  return {
    ok: false,
    message: err instanceof Error ? err.message : "Aktion fehlgeschlagen.",
  };
}

export async function connectIntegration(
  connectorKey: string,
): Promise<IntegrationActionResult> {
  try {
    const ctx = await requirePermission("integrations", "manage");
    const def = getConnector(connectorKey);
    if (!def) return { ok: false, message: "Unbekannter Connector." };
    if (!isConnectorAvailable(def)) {
      return {
        ok: false,
        message:
          def.status === "planned"
            ? `${def.name} ist noch nicht implementiert.`
            : `${def.name} benötigt Zugangsdaten (${def.requiredEnv?.join(", ")}), die derzeit nicht konfiguriert sind.`,
      };
    }
    await withOrg(ctx.organizationId, (tx) =>
      tx
        .insert(integration)
        .values({
          organizationId: ctx.organizationId,
          connectorKey,
          status: "connected",
          displayName: def.name,
          connectedByUserId: ctx.userId,
          lastSyncAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [integration.organizationId, integration.connectorKey],
          set: { status: "connected", error: null },
        }),
    );
    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "integration.connected",
      targetType: "integration",
      targetId: connectorKey,
      summary: `Integration "${def.name}" verbunden.`,
    });
    revalidatePath("/app/integrations");
    return { ok: true, message: `${def.name} verbunden.` };
  } catch (err) {
    return failure(err);
  }
}

export async function disconnectIntegration(
  connectorKey: string,
): Promise<IntegrationActionResult> {
  try {
    const ctx = await requirePermission("integrations", "manage");
    const def = getConnector(connectorKey);
    await withOrg(ctx.organizationId, (tx) =>
      tx
        .update(integration)
        .set({ status: "disconnected" })
        .where(eq(integration.connectorKey, connectorKey)),
    );
    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "integration.disconnected",
      targetType: "integration",
      targetId: connectorKey,
      summary: `Integration "${def?.name ?? connectorKey}" getrennt. Agenten verlieren damit den Zugriff auf diese Datenquelle.`,
    });
    revalidatePath("/app/integrations");
    return { ok: true, message: `${def?.name ?? connectorKey} getrennt.` };
  } catch (err) {
    return failure(err);
  }
}

/** Demo-Daten erzeugen (klar gekennzeichnet, Spec §28). */
export async function enableDemoMode(): Promise<IntegrationActionResult> {
  try {
    const ctx = await requirePermission("integrations", "manage");
    const result = await seedDemoData({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userLabel: ctx.session.user.name,
    });
    revalidatePath("/app/integrations");
    revalidatePath("/app/knowledge");
    revalidatePath("/app/workforce");
    revalidatePath("/app");
    return {
      ok: true,
      message: `Demo-Daten erzeugt: ${result.emails} E-Mails, ${result.events} Termine, ${result.deals} Deals, ${result.documents} Dokumente, ${result.agents} Agenten (Sandbox).`,
    };
  } catch (err) {
    return failure(err);
  }
}

/* -------------------------------------------------------------------------- */
/* Webhook                                                                    */
/* -------------------------------------------------------------------------- */

export interface WebhookSecretResult extends IntegrationActionResult {
  /** Nur unmittelbar nach dem Erzeugen — danach nie wieder abrufbar. */
  secret?: string;
  url?: string;
}

/**
 * Erzeugt ein neues Signaturgeheimnis. Der Klartext wird genau einmal
 * zurückgegeben; gespeichert wird er ausschließlich verschlüsselt.
 */
export async function createWebhookSecret(): Promise<WebhookSecretResult> {
  try {
    const ctx = await requirePermission("integrations", "manage");
    const { rotateWebhookSecret } = await import("./webhook");
    const setup = await rotateWebhookSecret({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userLabel: ctx.session.user.name,
    });
    revalidatePath("/app/integrations");
    return {
      ok: true,
      message:
        "Signaturgeheimnis erzeugt. Notieren Sie es jetzt — es wird nicht erneut angezeigt.",
      secret: setup.secret,
      url: setup.url,
    };
  } catch (err) {
    return failure(err);
  }
}

/* -------------------------------------------------------------------------- */
/* CSV                                                                        */
/* -------------------------------------------------------------------------- */

export interface CsvImportActionResult extends IntegrationActionResult {
  imported?: number;
  skipped?: number;
  problems?: { row: number; reason: string }[];
}

export async function importCsvFile(
  target: "tasks" | "deals",
  content: string,
): Promise<CsvImportActionResult> {
  try {
    const ctx = await requirePermission("integrations", "manage");
    if (target !== "tasks" && target !== "deals") {
      return { ok: false, message: "Unbekanntes Importziel." };
    }
    const { importCsv } = await import("./csv");
    const result = await importCsv({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userLabel: ctx.session.user.name,
      target,
      content,
    });
    if (result.imported > 0) {
      revalidatePath("/app/tasks");
      revalidatePath("/app/integrations");
    }
    return {
      ok: result.ok,
      message: result.message,
      imported: result.imported,
      skipped: result.skipped,
      problems: result.problems,
    };
  } catch (err) {
    return failure(err);
  }
}

export interface CsvExportActionResult extends IntegrationActionResult {
  filename?: string;
  content?: string;
  rowCount?: number;
}

export async function exportCsvFile(
  target: "tasks" | "deals" | "runs",
): Promise<CsvExportActionResult> {
  try {
    // Export ist ein Lesevorgang; die Sicht-Berechtigung genügt.
    const ctx = await requirePermission("integrations", "view");
    if (!["tasks", "deals", "runs"].includes(target)) {
      return { ok: false, message: "Unbekanntes Exportziel." };
    }
    const { exportCsv } = await import("./csv");
    const result = await exportCsv({
      organizationId: ctx.organizationId,
      target,
    });
    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "integration.csv_exported",
      targetType: target,
      summary: `CSV-Export (${target}): ${result.rowCount} Datensätze.`,
    });
    return {
      ok: true,
      message: `${result.rowCount} Datensätze exportiert.`,
      filename: result.filename,
      content: result.content,
      rowCount: result.rowCount,
    };
  } catch (err) {
    return failure(err);
  }
}

export async function disableDemoMode(): Promise<IntegrationActionResult> {
  try {
    const ctx = await requirePermission("integrations", "manage");
    await clearDemoData(ctx.organizationId);
    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "demo.cleared",
      summary: "Demo-Daten (E-Mails, Termine, Deals) entfernt.",
    });
    revalidatePath("/app/integrations");
    revalidatePath("/app");
    return { ok: true, message: "Demo-Daten entfernt." };
  } catch (err) {
    return failure(err);
  }
}
