import "server-only";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { adminDb, withOrg } from "@/server/db/client";
import {
  agentInstance,
  agentSchedule,
  approvalRequest,
  notificationPreference,
  organization,
  subscription,
} from "@/server/db/schema";
import { getAgentDefinition } from "@/server/agents/catalog";
import { recordAudit } from "@/server/audit";
import {
  MAX_CONSECUTIVE_FAILURES,
  type AgentRunPayload,
} from "./queues";
import { isDue, localParts, type ScheduleSpec } from "./schedule";

/**
 * Die fachliche Arbeit der Taktgeber.
 *
 * Bewusst getrennt von pg-boss: Diese Funktionen nehmen einen Zeitpunkt und
 * arbeiten gegen die Datenbank — ohne laufenden Worker, ohne Warteschlange.
 * Damit sind sie in Integrationstests direkt prüfbar, und ein Fehler in der
 * Fachlogik ist nicht von einem Fehler in der Warteschlange zu unterscheiden.
 *
 * Alle Funktionen lesen organisationsübergreifend mit der Owner-Rolle
 * (`adminDb`) — der Worker hat keinen Mandantenkontext, bevor er weiß, für wen
 * etwas zu tun ist. Jede Änderung an Mandantendaten läuft danach über
 * `withOrg()`.
 */

/* ------------------------------------------------------------------------- */
/* Zeitpläne                                                                  */
/* ------------------------------------------------------------------------- */

export interface DueSchedule {
  scheduleId: string;
  slot: string;
  payload: AgentRunPayload;
}

export interface ScheduleTickResult {
  checked: number;
  due: DueSchedule[];
  skipped: { scheduleId: string; reason: string }[];
}

function toSpec(row: typeof agentSchedule.$inferSelect): ScheduleSpec {
  return {
    frequency: row.frequency as ScheduleSpec["frequency"],
    hour: row.hour,
    minute: row.minute,
    weekday: row.weekday,
    timezone: row.timezone,
  };
}

/**
 * Findet fällige Zeitpläne und markiert sie sofort als gelaufen.
 *
 * Die Reihenfolge ist entscheidend: Der Slot wird **vor** dem Einreihen des
 * Laufs gesetzt, in einem bedingten UPDATE. Läuft der Takt doppelt — zwei
 * Worker, ein Neustart mitten im Durchlauf —, dann trifft das zweite UPDATE
 * keine Zeile mehr und der Lauf wird nicht doppelt eingereiht. Ein „genau
 * einmal" gibt es bei verteilter Arbeit nicht; „höchstens einmal je Fenster"
 * ist erreichbar und für Agentenläufe die richtige Wahl, weil ein doppelter
 * Lauf Geld kostet und nach außen wirken kann.
 */
export async function findDueSchedules(
  now: Date = new Date(),
): Promise<ScheduleTickResult> {
  const rows = await adminDb
    .select()
    .from(agentSchedule)
    .where(eq(agentSchedule.enabled, true));

  const due: DueSchedule[] = [];
  const skipped: { scheduleId: string; reason: string }[] = [];

  for (const row of rows) {
    const { due: isNow, slot } = isDue(toSpec(row), now, row.lastRunSlot);
    if (!isNow || slot === null) continue;

    // Der Agent muss betriebsbereit sein. Ein pausierter Agent hat einen Grund
    // dafür — ein Zeitplan darf ihn nicht umgehen.
    const [instance] = await adminDb
      .select()
      .from(agentInstance)
      .where(eq(agentInstance.id, row.agentInstanceId));
    if (!instance || instance.status !== "active") {
      skipped.push({
        scheduleId: row.id,
        reason: `Agent ist nicht aktiv (Status: ${instance?.status ?? "gelöscht"}).`,
      });
      continue;
    }
    if (instance.disabledCapabilities.includes(row.capabilityKey)) {
      skipped.push({
        scheduleId: row.id,
        reason: `Fähigkeit "${row.capabilityKey}" ist bei diesem Agenten abgeschaltet.`,
      });
      continue;
    }
    const definition = getAgentDefinition(instance.definitionSlug);
    const capability = definition?.capabilities.find(
      (c) => c.key === row.capabilityKey,
    );
    if (!capability) {
      skipped.push({
        scheduleId: row.id,
        reason: `Fähigkeit "${row.capabilityKey}" existiert im Katalog nicht mehr.`,
      });
      continue;
    }

    // Slot beanspruchen. Nur wer die Zeile tatsächlich verändert, reiht ein.
    const claimed = await adminDb
      .update(agentSchedule)
      .set({ lastRunSlot: slot, lastRunAt: now })
      .where(
        and(
          eq(agentSchedule.id, row.id),
          // Genau der Zustand, den wir gelesen haben — sonst war jemand schneller.
          row.lastRunSlot === null
            ? sql`${agentSchedule.lastRunSlot} IS NULL`
            : eq(agentSchedule.lastRunSlot, row.lastRunSlot),
        ),
      )
      .returning({ id: agentSchedule.id });
    if (claimed.length === 0) {
      skipped.push({
        scheduleId: row.id,
        reason: "Fenster wurde parallel schon beansprucht.",
      });
      continue;
    }

    due.push({
      scheduleId: row.id,
      slot,
      payload: {
        organizationId: row.organizationId,
        instanceId: row.agentInstanceId,
        capabilityKey: row.capabilityKey,
        goal: `Zeitplan: ${capability.name}`,
        scheduleId: row.id,
        slot,
        input: {},
      },
    });
  }

  return { checked: rows.length, due, skipped };
}

/**
 * Trägt das Ergebnis eines geplanten Laufs am Zeitplan nach.
 *
 * Ein dauerhaft scheiternder Zeitplan wird abgeschaltet. Ohne diese Grenze
 * würde ein Agent mit fehlerhafter Konfiguration jede Nacht erneut Kontingent
 * verbrauchen, ohne dass jemand es merkt.
 */
export async function recordScheduleOutcome(params: {
  scheduleId: string;
  organizationId: string;
  ok: boolean;
  runId?: string;
  status: string;
}): Promise<{ disabled: boolean }> {
  const [row] = await adminDb
    .select()
    .from(agentSchedule)
    .where(eq(agentSchedule.id, params.scheduleId));
  if (!row) return { disabled: false };

  const failures = params.ok ? 0 : row.consecutiveFailures + 1;
  const shouldDisable = failures >= MAX_CONSECUTIVE_FAILURES;

  await adminDb
    .update(agentSchedule)
    .set({
      lastRunId: params.runId ?? null,
      lastStatus: params.status.slice(0, 200),
      consecutiveFailures: failures,
      ...(shouldDisable
        ? {
            enabled: false,
            disabledReason: `Automatisch abgeschaltet nach ${failures} Fehlläufen in Folge. Letzter Status: ${params.status.slice(0, 120)}`,
          }
        : {}),
    })
    .where(eq(agentSchedule.id, params.scheduleId));

  if (shouldDisable) {
    await recordAudit({
      organizationId: params.organizationId,
      actorType: "system",
      actorLabel: "Zeitsteuerung",
      action: "schedule.auto_disabled",
      targetType: "agent_schedule",
      targetId: params.scheduleId,
      summary: `Zeitplan nach ${failures} Fehlläufen in Folge abgeschaltet. Letzter Status: ${params.status.slice(0, 120)}`,
    });
    // Die Organisation soll das erfahren, nicht erst beim nächsten Blick in die
    // Oberfläche.
    const { notifyOrganization } = await import("@/server/notifications/service");
    await notifyOrganization({
      organizationId: params.organizationId,
      type: "agent_paused",
      title: "Zeitplan automatisch abgeschaltet",
      body: `Ein geplanter Agentenlauf ist ${failures} Mal in Folge fehlgeschlagen und wurde deshalb angehalten. Bitte prüfen Sie die Konfiguration.`,
      href: "/app/agents",
    });
  }

  return { disabled: shouldDisable };
}

/* ------------------------------------------------------------------------- */
/* Tageszusammenfassungen                                                     */
/* ------------------------------------------------------------------------- */

export interface DigestTickResult {
  candidates: number;
  delivered: number;
  skipped: number;
}

/**
 * Versendet Tageszusammenfassungen, deren Uhrzeit erreicht ist.
 *
 * Die Uhrzeit steht als `HH:MM` in den Benachrichtigungseinstellungen. Ein
 * Versand je Person und Tag — `lastDigestAt` verhindert Wiederholungen, auch
 * wenn dieser Takt alle 15 Minuten läuft.
 */
export async function runDigestTick(
  now: Date = new Date(),
): Promise<DigestTickResult> {
  const rows = await adminDb
    .select()
    .from(notificationPreference)
    .where(eq(notificationPreference.dailyDigest, true));

  let delivered = 0;
  let skipped = 0;

  for (const pref of rows) {
    const [hourText, minuteText] = (pref.digestHour ?? "08:00").split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText ?? "0");
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      skipped++;
      continue;
    }

    // Zeitzone der Organisation aus einem aktiven Zeitplan ableiten, sonst
    // Europe/Berlin. Eine eigene Zeitzone je Organisation gibt es noch nicht.
    const timezone = await organizationTimezone(pref.organizationId);
    const local = localParts(now, timezone);
    const reached =
      local.hour > hour || (local.hour === hour && local.minute >= minute);
    if (!reached) {
      skipped++;
      continue;
    }
    // Schon heute versendet?
    if (pref.lastDigestAt) {
      const lastLocal = localParts(pref.lastDigestAt, timezone);
      if (
        lastLocal.year === local.year &&
        lastLocal.month === local.month &&
        lastLocal.day === local.day
      ) {
        skipped++;
        continue;
      }
    }

    const { sendDigest } = await import("@/server/notifications/service");
    const result = await sendDigest(pref.organizationId, pref.userId);
    if (result.delivered) delivered++;
    else skipped++;
  }

  return { candidates: rows.length, delivered, skipped };
}

/**
 * Zeitzone einer Organisation. Bis es eine eigene Einstellung gibt, wird sie
 * aus einem vorhandenen Zeitplan übernommen — das ist die einzige Stelle, an
 * der eine Organisation heute eine Zeitzone angibt.
 */
async function organizationTimezone(organizationId: string): Promise<string> {
  const [row] = await adminDb
    .select({ timezone: agentSchedule.timezone })
    .from(agentSchedule)
    .where(eq(agentSchedule.organizationId, organizationId))
    .limit(1);
  return row?.timezone ?? "Europe/Berlin";
}

/* ------------------------------------------------------------------------- */
/* Abrechnung                                                                 */
/* ------------------------------------------------------------------------- */

export interface BillingTickResult {
  organizations: number;
  invoiced: number;
  skipped: { organizationId: string; reason: string }[];
}

/**
 * Stellt für abgeschlossene Perioden Rechnungen. Läuft täglich, erzeugt aber
 * höchstens eine Rechnung je Organisation und Periode.
 *
 * Die Periode ist der Kalendermonat. Abgerechnet wird ab dem zweiten Tag des
 * Folgemonats, damit Läufe am Monatsletzten noch vollständig erfasst sind.
 */
export async function runBillingTick(
  now: Date = new Date(),
): Promise<BillingTickResult> {
  const dayOfMonth = now.getUTCDate();
  if (dayOfMonth < 2) {
    return { organizations: 0, invoiced: 0, skipped: [] };
  }

  const period = previousPeriod(now);
  const subs = await adminDb
    .select({
      organizationId: subscription.organizationId,
      status: subscription.status,
      provider: subscription.provider,
    })
    .from(subscription)
    .where(eq(subscription.status, "active"));

  let invoiced = 0;
  const skipped: { organizationId: string; reason: string }[] = [];

  for (const sub of subs) {
    const [org] = await adminDb
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, sub.organizationId));
    if (!org) {
      skipped.push({
        organizationId: sub.organizationId,
        reason: "Organisation nicht gefunden.",
      });
      continue;
    }

    // Doppelte Rechnungen sind der teuerste Fehler, den ein Abrechnungsjob
    // machen kann. Deshalb wird gegen den Ausstellungszeitpunkt geprüft: Liegt
    // schon eine Rechnung aus diesem Kalendermonat vor, wird nicht erneut
    // gestellt — auch wenn der Takt mehrfach am Tag läuft.
    const { invoiceRecord } = await import("@/server/db/schema");
    const existing = await withOrg(sub.organizationId, (tx) =>
      tx
        .select({ id: invoiceRecord.id, issuedAt: invoiceRecord.issuedAt })
        .from(invoiceRecord)
        .where(sql`${invoiceRecord.issuedAt} >= ${monthStart(now).toISOString()}`)
        .limit(1),
    );
    if (existing.length > 0) {
      skipped.push({
        organizationId: sub.organizationId,
        reason: `Für die Periode ${period} liegt bereits eine Rechnung vor.`,
      });
      continue;
    }

    const { issueInvoice } = await import("@/server/billing/service");
    const result = await issueInvoice({
      organizationId: sub.organizationId,
      organizationName: org.name,
      // Ohne hinterlegte Rechnungsadresse geht die Rechnung in den Postausgang
      // und wird dort sichtbar — sie verschwindet nicht.
      contactEmail: "",
    });
    if (result.ok) invoiced++;
    else
      skipped.push({
        organizationId: sub.organizationId,
        reason: result.message,
      });
  }

  return { organizations: subs.length, invoiced, skipped };
}

/** Beginn des laufenden Kalendermonats in UTC. */
export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Periodenkennung `YYYY-MM` des Vormonats. */
export function previousPeriod(now: Date): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-basiert; 0 bedeutet Januar
  const target = month === 0 ? { y: year - 1, m: 12 } : { y: year, m: month };
  return `${target.y}-${String(target.m).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------------- */
/* Abgelaufene Freigaben                                                      */
/* ------------------------------------------------------------------------- */

/**
 * Setzt Freigaben auf „abgelaufen", deren Frist verstrichen ist.
 *
 * Ohne diesen Takt bliebe eine vorbereitete Aktion unbegrenzt freigebbar — auch
 * Wochen später, wenn ihr Inhalt längst überholt ist. Genau das soll `expiresAt`
 * verhindern.
 */
export async function runApprovalExpiryTick(
  now: Date = new Date(),
): Promise<{ expired: number }> {
  const rows = await adminDb
    .update(approvalRequest)
    .set({ status: "expired" })
    .where(
      and(
        eq(approvalRequest.status, "pending"),
        isNotNull(approvalRequest.expiresAt),
        lt(approvalRequest.expiresAt, now),
      ),
    )
    .returning({
      id: approvalRequest.id,
      organizationId: approvalRequest.organizationId,
      title: approvalRequest.title,
    });

  for (const row of rows) {
    await recordAudit({
      organizationId: row.organizationId,
      actorType: "system",
      actorLabel: "Zeitsteuerung",
      action: "approval.expired",
      targetType: "approval_request",
      targetId: row.id,
      summary: `Freigabe „${row.title}" ist abgelaufen und wurde nicht ausgeführt.`,
    });
  }

  return { expired: rows.length };
}
