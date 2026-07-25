import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth/guards";
import { adminDb } from "@/server/db/client";
import { platformAdmin, supportAccessLog } from "@/server/db/schema";
import { recordAudit } from "@/server/audit";

/**
 * Zugang zum Plattform-Adminbereich.
 *
 * Zwei Stufen, bewusst getrennt:
 *  - "support": darf Organisationen und Zustände einsehen, nichts ändern.
 *  - "admin":   darf zusätzlich Preise, Pläne und Funktionsschalter ändern.
 *
 * Die Berechtigung hängt nicht an einer Rolle innerhalb einer
 * Kundenorganisation, sondern an einem eigenen Eintrag in `platform_admin`.
 * Damit kann niemand durch Anlegen einer eigenen Organisation zum
 * Plattform-Admin werden.
 */

export type PlatformLevel = "support" | "admin";

export interface PlatformContext {
  userId: string;
  userLabel: string;
  email: string;
  level: PlatformLevel;
}

export class PlatformAccessError extends Error {
  readonly status = 403;
  constructor(message = "Kein Zugriff auf den Plattformbereich.") {
    super(message);
    this.name = "PlatformAccessError";
  }
}

export async function getPlatformContext(): Promise<PlatformContext | null> {
  const session = await requireSession();
  const [row] = await adminDb
    .select()
    .from(platformAdmin)
    .where(eq(platformAdmin.userId, session.user.id));
  if (!row) return null;
  return {
    userId: session.user.id,
    userLabel: session.user.name,
    email: session.user.email,
    level: row.level === "admin" ? "admin" : "support",
  };
}

/** Für Seiten: leitet auf /app um, statt die Existenz des Bereichs zu bestätigen. */
export async function requirePlatformAccess(
  minimum: PlatformLevel = "support",
): Promise<PlatformContext> {
  const ctx = await getPlatformContext();
  if (!ctx) redirect("/app");
  if (minimum === "admin" && ctx.level !== "admin") redirect("/admin");
  return ctx;
}

/** Für Server Actions: wirft, statt umzuleiten. */
export async function assertPlatformAccess(
  minimum: PlatformLevel = "support",
): Promise<PlatformContext> {
  const ctx = await getPlatformContext();
  if (!ctx) throw new PlatformAccessError();
  if (minimum === "admin" && ctx.level !== "admin") {
    throw new PlatformAccessError(
      "Diese Änderung erfordert die Stufe „admin“ im Plattformbereich.",
    );
  }
  return ctx;
}

/**
 * Protokolliert einen Support-Zugriff auf Kundendaten — zwingend VOR dem
 * Laden der Daten aufzurufen.
 *
 * Der Eintrag entsteht doppelt: im Plattform-Protokoll (für den Betreiber)
 * und im Audit-Log der betroffenen Organisation (für die Kundin). So sieht
 * die Kundin in ihrem eigenen Protokoll, wer wann und warum hineingesehen
 * hat — Einsicht ohne Spur gibt es nicht.
 */
export async function logSupportAccess(params: {
  ctx: PlatformContext;
  organizationId: string;
  reason: string;
  scope: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const reason = params.reason.trim();
  if (reason.length < 10) {
    throw new PlatformAccessError(
      "Bitte geben Sie einen nachvollziehbaren Grund an (mindestens 10 Zeichen).",
    );
  }

  await adminDb.insert(supportAccessLog).values({
    organizationId: params.organizationId,
    userId: params.ctx.userId,
    userLabel: params.ctx.userLabel,
    reason,
    scope: params.scope,
    metadata: params.metadata ?? null,
  });

  await recordAudit({
    organizationId: params.organizationId,
    actorType: "system",
    actorId: params.ctx.userId,
    actorLabel: `Support: ${params.ctx.userLabel}`,
    action: "support.access",
    targetType: "organization",
    targetId: params.organizationId,
    summary: `Support-Zugriff auf "${params.scope}". Grund: ${reason}`,
    metadata: { level: params.ctx.level, ...params.metadata },
  });
}
