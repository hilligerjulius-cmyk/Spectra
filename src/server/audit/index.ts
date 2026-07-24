import { adminDb } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";

export interface AuditEntry {
  organizationId: string;
  actorType: "user" | "agent" | "system";
  actorId?: string | null;
  actorLabel: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Schreibt einen Audit-Eintrag. Nutzt bewusst die Owner-Verbindung, damit
 * Audit-Einträge auch außerhalb eines Mandanten-Transaktionskontexts (z. B.
 * Systemjobs, fehlgeschlagene Zugriffe) zuverlässig persistiert werden.
 * Lesezugriffe laufen dagegen RLS-gescoped über withOrg().
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  await adminDb.insert(auditLog).values({
    organizationId: entry.organizationId,
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    actorLabel: entry.actorLabel,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    summary: entry.summary,
    metadata: entry.metadata ?? null,
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
  });
}
