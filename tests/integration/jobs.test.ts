import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Hintergrund-Worker: Zeitpläne, Wiederholungen, Abrechnung, Freigabe-Verfall.
 *
 * Geprüft wird die Fachlogik der Taktgeber gegen die echte Datenbank — ohne
 * laufenden pg-boss-Prozess. Genau dafür ist `tick.ts` von der Warteschlange
 * getrennt: Ein Fehler in der Fachlogik ist hier eindeutig als solcher
 * erkennbar und nicht von einem Warteschlangenproblem überlagert.
 *
 * Schwerpunkt sind die Fälle, die im Betrieb Geld kosten oder Vertrauen
 * zerstören: doppelte Läufe, Läufe pausierter Agenten, dauerhaft scheiternde
 * Zeitpläne und doppelte Rechnungen.
 */

let orgId: string;
let userId: string;
let instanceId: string;

async function createSchedule(overrides: Record<string, unknown> = {}) {
  const { adminDb } = await import("@/server/db/client");
  const { agentSchedule } = await import("@/server/db/schema");
  const [row] = await adminDb
    .insert(agentSchedule)
    .values({
      organizationId: orgId,
      agentInstanceId: instanceId,
      capabilityKey: "daily-briefing",
      frequency: "daily",
      hour: 7,
      minute: 0,
      timezone: "Europe/Berlin",
      enabled: true,
      createdByUserId: userId,
      ...overrides,
    })
    .returning();
  return row!;
}

beforeAll(async () => {
  const { adminDb } = await import("@/server/db/client");
  const { organization, user, agentInstance, member } = await import(
    "@/server/db/schema"
  );
  const { getAgentDefinition } = await import("@/server/agents/catalog");

  orgId = crypto.randomUUID();
  userId = crypto.randomUUID();
  await adminDb.insert(user).values({
    id: userId,
    name: "Zeitplan-Tester",
    email: `jobs-${userId}@example.de`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await adminDb.insert(organization).values({
    id: orgId,
    name: "Zeitplantest",
    slug: `zeitplan-${orgId.slice(0, 8)}`,
    createdAt: new Date(),
  });
  // Ohne Mitgliedschaft gibt es niemanden zu benachrichtigen — in echten
  // Organisationen existiert immer mindestens die Inhaberin.
  await adminDb.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId,
    role: "owner",
    createdAt: new Date(),
  });

  const def = getAgentDefinition("chief-of-staff")!;
  instanceId = crypto.randomUUID();
  await adminDb.insert(agentInstance).values({
    id: instanceId,
    organizationId: orgId,
    definitionSlug: def.slug,
    displayName: def.personaName,
    status: "active",
    allowedTools: [
      ...new Set(def.capabilities.flatMap((c) => c.requiredTools)),
    ],
  });
});

beforeEach(async () => {
  const { adminDb } = await import("@/server/db/client");
  const { agentSchedule } = await import("@/server/db/schema");
  await adminDb
    .delete(agentSchedule)
    .where(eq(agentSchedule.organizationId, orgId));
});

afterAll(async () => {
  const { adminDb } = await import("@/server/db/client");
  const { organization, user } = await import("@/server/db/schema");
  await adminDb.delete(organization).where(eq(organization.id, orgId));
  await adminDb.delete(user).where(eq(user.id, userId));
});

describe("Warteschlangen-Konfiguration", () => {
  /*
   * Regression: pg-boss verlangt, dass eine als `deadLetter` verwiesene
   * Warteschlange bereits existiert. In der ersten Fassung wurde in
   * Schlüsselreihenfolge angelegt — der Worker startete deshalb überhaupt
   * nicht („Queue dead-letter does not exist").
   */
  it("legt Endlager-Warteschlangen vor ihren Nutzern an", async () => {
    const { queueCreationOrder } = await import("@/server/jobs/client");
    const { QUEUE_CONFIG, QUEUES } = await import("@/server/jobs/queues");

    const order = queueCreationOrder();
    expect(new Set(order).size).toBe(Object.values(QUEUES).length);

    for (const [index, name] of order.entries()) {
      const target = (QUEUE_CONFIG[name] as { deadLetter?: string }).deadLetter;
      if (!target) continue;
      const targetIndex = order.indexOf(target as (typeof order)[number]);
      expect(
        targetIndex,
        `${target} muss vor ${name} angelegt werden`,
      ).toBeLessThan(index);
    }
  });
});

describe("Fällige Zeitpläne", () => {
  it("findet einen fälligen Zeitplan und beansprucht das Fenster", async () => {
    const schedule = await createSchedule();
    const { findDueSchedules } = await import("@/server/jobs/tick");

    // 06:00 UTC = 08:00 Berlin, geplant war 07:00.
    const result = await findDueSchedules(new Date("2026-07-27T06:00:00Z"));
    const mine = result.due.filter((d) => d.scheduleId === schedule.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.slot).toBe("2026-07-27");
    expect(mine[0]!.payload.organizationId).toBe(orgId);
    expect(mine[0]!.payload.capabilityKey).toBe("daily-briefing");
  });

  it("reiht dasselbe Fenster nicht zweimal ein", async () => {
    const schedule = await createSchedule();
    const { findDueSchedules } = await import("@/server/jobs/tick");
    const now = new Date("2026-07-27T06:00:00Z");

    const first = await findDueSchedules(now);
    expect(first.due.some((d) => d.scheduleId === schedule.id)).toBe(true);

    // Zweiter Takt in derselben Minute — der Worker prüft jede Minute.
    const second = await findDueSchedules(now);
    expect(second.due.some((d) => d.scheduleId === schedule.id)).toBe(false);
  });

  it("startet keinen Lauf für einen pausierten Agenten", async () => {
    const { adminDb } = await import("@/server/db/client");
    const { agentInstance } = await import("@/server/db/schema");
    const schedule = await createSchedule();
    await adminDb
      .update(agentInstance)
      .set({ status: "paused" })
      .where(eq(agentInstance.id, instanceId));

    const { findDueSchedules } = await import("@/server/jobs/tick");
    const result = await findDueSchedules(new Date("2026-07-27T06:00:00Z"));

    expect(result.due.some((d) => d.scheduleId === schedule.id)).toBe(false);
    expect(
      result.skipped.find((s) => s.scheduleId === schedule.id)?.reason,
    ).toMatch(/nicht aktiv/);
    // Das Fenster bleibt unbeansprucht — nach dem Fortsetzen soll er laufen.
    const { agentSchedule } = await import("@/server/db/schema");
    const [row] = await adminDb
      .select()
      .from(agentSchedule)
      .where(eq(agentSchedule.id, schedule.id));
    expect(row!.lastRunSlot).toBeNull();

    await adminDb
      .update(agentInstance)
      .set({ status: "active" })
      .where(eq(agentInstance.id, instanceId));
  });

  it("überspringt eine abgeschaltete Fähigkeit", async () => {
    const { adminDb } = await import("@/server/db/client");
    const { agentInstance } = await import("@/server/db/schema");
    const schedule = await createSchedule();
    await adminDb
      .update(agentInstance)
      .set({ disabledCapabilities: ["daily-briefing"] })
      .where(eq(agentInstance.id, instanceId));

    const { findDueSchedules } = await import("@/server/jobs/tick");
    const result = await findDueSchedules(new Date("2026-07-27T06:00:00Z"));
    expect(
      result.skipped.find((s) => s.scheduleId === schedule.id)?.reason,
    ).toMatch(/abgeschaltet/);

    await adminDb
      .update(agentInstance)
      .set({ disabledCapabilities: [] })
      .where(eq(agentInstance.id, instanceId));
  });

  it("berücksichtigt abgeschaltete Zeitpläne nicht", async () => {
    const schedule = await createSchedule({ enabled: false });
    const { findDueSchedules } = await import("@/server/jobs/tick");
    const result = await findDueSchedules(new Date("2026-07-27T06:00:00Z"));
    expect(result.due.some((d) => d.scheduleId === schedule.id)).toBe(false);
    expect(result.skipped.some((s) => s.scheduleId === schedule.id)).toBe(false);
  });

  it("meldet eine Fähigkeit, die es im Katalog nicht mehr gibt", async () => {
    const schedule = await createSchedule({ capabilityKey: "gibt-es-nicht" });
    const { findDueSchedules } = await import("@/server/jobs/tick");
    const result = await findDueSchedules(new Date("2026-07-27T06:00:00Z"));
    expect(
      result.skipped.find((s) => s.scheduleId === schedule.id)?.reason,
    ).toMatch(/existiert im Katalog nicht/);
  });
});

describe("Ergebnis eines geplanten Laufs", () => {
  it("setzt den Fehlerzähler bei Erfolg zurück", async () => {
    const { adminDb } = await import("@/server/db/client");
    const { agentSchedule } = await import("@/server/db/schema");
    const schedule = await createSchedule({ consecutiveFailures: 3 });
    const { recordScheduleOutcome } = await import("@/server/jobs/tick");

    await recordScheduleOutcome({
      scheduleId: schedule.id,
      organizationId: orgId,
      ok: true,
      runId: "lauf-1",
      status: "Briefing erstellt",
    });

    const [row] = await adminDb
      .select()
      .from(agentSchedule)
      .where(eq(agentSchedule.id, schedule.id));
    expect(row!.consecutiveFailures).toBe(0);
    expect(row!.enabled).toBe(true);
    expect(row!.lastRunId).toBe("lauf-1");
  });

  it("schaltet einen dauerhaft scheiternden Zeitplan ab und meldet es", async () => {
    const { adminDb } = await import("@/server/db/client");
    const { agentSchedule, auditLog, notification } = await import(
      "@/server/db/schema"
    );
    const { MAX_CONSECUTIVE_FAILURES } = await import("@/server/jobs/queues");
    const { recordScheduleOutcome } = await import("@/server/jobs/tick");
    const schedule = await createSchedule();

    let lastResult = { disabled: false };
    for (let i = 0; i < MAX_CONSECUTIVE_FAILURES; i++) {
      lastResult = await recordScheduleOutcome({
        scheduleId: schedule.id,
        organizationId: orgId,
        ok: false,
        status: "Werkzeug nicht verfügbar",
      });
    }

    expect(lastResult.disabled).toBe(true);
    const [row] = await adminDb
      .select()
      .from(agentSchedule)
      .where(eq(agentSchedule.id, schedule.id));
    expect(row!.enabled).toBe(false);
    expect(row!.disabledReason).toContain("Fehlläufen in Folge");

    // Die Abschaltung muss nachvollziehbar sein und auffallen.
    const entries = await adminDb
      .select()
      .from(auditLog)
      .where(eq(auditLog.organizationId, orgId));
    expect(
      entries.some((e) => e.action === "schedule.auto_disabled"),
    ).toBe(true);
    const messages = await adminDb
      .select()
      .from(notification)
      .where(eq(notification.organizationId, orgId));
    expect(
      messages.some((m) => m.title.includes("Zeitplan automatisch abgeschaltet")),
    ).toBe(true);
  });

  it("schaltet nicht ab, wenn zwischendurch ein Lauf gelingt", async () => {
    const { adminDb } = await import("@/server/db/client");
    const { agentSchedule } = await import("@/server/db/schema");
    const { MAX_CONSECUTIVE_FAILURES } = await import("@/server/jobs/queues");
    const { recordScheduleOutcome } = await import("@/server/jobs/tick");
    const schedule = await createSchedule();

    for (let i = 0; i < MAX_CONSECUTIVE_FAILURES - 1; i++) {
      await recordScheduleOutcome({
        scheduleId: schedule.id,
        organizationId: orgId,
        ok: false,
        status: "Fehler",
      });
    }
    await recordScheduleOutcome({
      scheduleId: schedule.id,
      organizationId: orgId,
      ok: true,
      status: "Erfolg",
    });
    await recordScheduleOutcome({
      scheduleId: schedule.id,
      organizationId: orgId,
      ok: false,
      status: "Fehler",
    });

    const [row] = await adminDb
      .select()
      .from(agentSchedule)
      .where(eq(agentSchedule.id, schedule.id));
    expect(row!.enabled).toBe(true);
    expect(row!.consecutiveFailures).toBe(1);
  });
});

describe("Geplanter Lauf von Anfang bis Ende", () => {
  it("führt einen fälligen Zeitplan tatsächlich aus und trägt das Ergebnis nach", async () => {
    const { adminDb, withOrg } = await import("@/server/db/client");
    const { agentSchedule, agentRun } = await import("@/server/db/schema");
    const { findDueSchedules, recordScheduleOutcome } = await import(
      "@/server/jobs/tick"
    );
    const { startRun } = await import("@/server/agents/runtime/engine");
    const schedule = await createSchedule();

    const due = await findDueSchedules(new Date("2026-07-27T06:00:00Z"));
    const item = due.due.find((d) => d.scheduleId === schedule.id)!;
    expect(item).toBeDefined();

    // Genau das, was der Warteschlangen-Handler tut.
    const outcome = await startRun({
      organizationId: item.payload.organizationId,
      instanceId: item.payload.instanceId,
      capabilityKey: item.payload.capabilityKey,
      goal: item.payload.goal,
      input: {},
      trigger: { type: "schedule", scheduleId: item.scheduleId, slot: item.slot },
      sandbox: false,
      requestedByUserId: null,
      idempotencyKey: `schedule:${item.scheduleId}:${item.slot}`,
    });
    expect(["completed", "waiting_approval"]).toContain(outcome.status);

    const [run] = await withOrg(orgId, (tx) =>
      tx.select().from(agentRun).where(eq(agentRun.id, outcome.runId)),
    );
    // Der Auslöser muss als Zeitplan erkennbar sein, nicht als manueller Start.
    expect((run!.trigger as { type: string }).type).toBe("schedule");
    expect(run!.sandbox).toBe(false);

    await recordScheduleOutcome({
      scheduleId: item.scheduleId,
      organizationId: orgId,
      ok: true,
      runId: outcome.runId,
      status: outcome.summary ?? outcome.status,
    });
    const [row] = await adminDb
      .select()
      .from(agentSchedule)
      .where(eq(agentSchedule.id, schedule.id));
    expect(row!.lastRunId).toBe(outcome.runId);
    expect(row!.lastStatus).toBeTruthy();
  });

  it("erzeugt bei doppelter Ausführung desselben Fensters nur einen Lauf", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { agentRun } = await import("@/server/db/schema");
    const { startRun } = await import("@/server/agents/runtime/engine");
    const schedule = await createSchedule({ capabilityKey: "prioritize" });

    const key = `schedule:${schedule.id}:2026-07-28`;
    const first = await startRun({
      organizationId: orgId,
      instanceId,
      capabilityKey: "prioritize",
      goal: "Zeitplan: Priorisierung",
      trigger: { type: "schedule", slot: "2026-07-28" },
      sandbox: false,
      requestedByUserId: null,
      idempotencyKey: key,
    });
    const second = await startRun({
      organizationId: orgId,
      instanceId,
      capabilityKey: "prioritize",
      goal: "Zeitplan: Priorisierung",
      trigger: { type: "schedule", slot: "2026-07-28" },
      sandbox: false,
      requestedByUserId: null,
      idempotencyKey: key,
    });

    // Die Runtime gibt bei bekanntem Schlüssel den bestehenden Lauf zurück.
    expect(second.runId).toBe(first.runId);
    const runs = await withOrg(orgId, (tx) =>
      tx.select().from(agentRun).where(eq(agentRun.idempotencyKey, key)),
    );
    expect(runs).toHaveLength(1);
  });
});

describe("Abgelaufene Freigaben", () => {
  it("setzt überfällige Freigaben auf abgelaufen und protokolliert das", async () => {
    const { adminDb, withOrg } = await import("@/server/db/client");
    const { approvalRequest, auditLog } = await import("@/server/db/schema");
    const { runApprovalExpiryTick } = await import("@/server/jobs/tick");

    const [overdue] = await withOrg(orgId, (tx) =>
      tx
        .insert(approvalRequest)
        .values({
          organizationId: orgId,
          agentInstanceId: instanceId,
          capabilityKey: "daily-briefing",
          actionType: "task.create",
          title: "Längst überholte Aktion",
          reasoning: "Test",
          payload: {},
          riskLevel: "low",
          status: "pending",
          expiresAt: new Date(Date.now() - 60 * 60 * 1000),
        })
        .returning({ id: approvalRequest.id }),
    );
    const [fresh] = await withOrg(orgId, (tx) =>
      tx
        .insert(approvalRequest)
        .values({
          organizationId: orgId,
          agentInstanceId: instanceId,
          capabilityKey: "daily-briefing",
          actionType: "task.create",
          title: "Noch gültig",
          reasoning: "Test",
          payload: {},
          riskLevel: "low",
          status: "pending",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        })
        .returning({ id: approvalRequest.id }),
    );

    const result = await runApprovalExpiryTick(new Date());
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const rows = await withOrg(orgId, (tx) =>
      tx.select().from(approvalRequest),
    );
    expect(rows.find((r) => r.id === overdue!.id)!.status).toBe("expired");
    // Eine noch gültige Freigabe darf nicht angefasst werden.
    expect(rows.find((r) => r.id === fresh!.id)!.status).toBe("pending");

    const entries = await adminDb
      .select()
      .from(auditLog)
      .where(eq(auditLog.organizationId, orgId));
    expect(entries.some((e) => e.action === "approval.expired")).toBe(true);
  });
});

describe("Abrechnungstakt", () => {
  it("rechnet vor dem zweiten Tag des Monats nicht ab", async () => {
    const { runBillingTick } = await import("@/server/jobs/tick");
    // 1. August: Läufe vom 31. Juli könnten noch nicht vollständig erfasst sein.
    const result = await runBillingTick(new Date("2026-08-01T03:10:00Z"));
    expect(result.organizations).toBe(0);
    expect(result.invoiced).toBe(0);
  });

  it("bestimmt die Vorperiode korrekt, auch über den Jahreswechsel", async () => {
    const { previousPeriod } = await import("@/server/jobs/tick");
    expect(previousPeriod(new Date("2026-08-03T00:00:00Z"))).toBe("2026-07");
    expect(previousPeriod(new Date("2026-01-05T00:00:00Z"))).toBe("2025-12");
    expect(previousPeriod(new Date("2026-03-02T00:00:00Z"))).toBe("2026-02");
  });

  it("stellt für eine Periode höchstens eine Rechnung", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { invoiceRecord } = await import("@/server/db/schema");
    const { runBillingTick, monthStart } = await import("@/server/jobs/tick");
    const { ensureSubscription } = await import("@/server/billing/service");
    const { adminDb } = await import("@/server/db/client");
    const { subscription } = await import("@/server/db/schema");
    await ensureSubscription(orgId);
    // Abgerechnet wird nur bei aktivem Abo. `ensureSubscription` legt
    // "trialing" an — eine Testphase wird bewusst nicht abgerechnet.
    await adminDb
      .update(subscription)
      .set({ status: "active" })
      .where(eq(subscription.organizationId, orgId));

    const now = new Date("2026-08-03T03:10:00Z");
    // Eine Rechnung aus diesem Kalendermonat liegt bereits vor.
    await withOrg(orgId, (tx) =>
      tx.insert(invoiceRecord).values({
        organizationId: orgId,
        number: "RE-TEST-0001",
        status: "issued",
        periodStart: monthStart(now),
        periodEnd: now,
        subtotalCents: 19900,
        discountCents: 0,
        totalCents: 19900,
        lineItems: [],
        provider: "mock",
        issuedAt: now,
      }),
    );

    const result = await runBillingTick(now);
    const mine = result.skipped.find((s) => s.organizationId === orgId);
    expect(mine?.reason).toMatch(/bereits eine Rechnung/);
  });
});

describe("Tageszusammenfassungen", () => {
  it("versendet nicht, bevor die eingestellte Uhrzeit erreicht ist", async () => {
    const { updatePreference } = await import("@/server/notifications/service");
    const { runDigestTick } = await import("@/server/jobs/tick");

    await updatePreference({
      organizationId: orgId,
      userId,
      inAppTypes: ["approval_required"],
      emailTypes: [],
      dailyDigest: true,
      digestHour: "18:00",
    });

    // 06:00 UTC = 08:00 Berlin — 18:00 ist noch nicht erreicht.
    const result = await runDigestTick(new Date("2026-07-27T06:00:00Z"));
    expect(result.candidates).toBeGreaterThanOrEqual(1);
    expect(result.delivered).toBe(0);
  });
});
