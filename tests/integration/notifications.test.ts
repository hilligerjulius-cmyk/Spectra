import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Benachrichtigungen und Berichte gegen die Test-DB.
 *
 * Kernzusagen, die hier belegt werden:
 *  - Einstellungen werden respektiert (kein Versand ohne Zustimmung).
 *  - Ohne SMTP wird nichts versendet, sondern nachvollziehbar abgelegt.
 *  - Berichte enthalten ausschließlich gemessene Werte; Sandbox-Läufe zählen
 *    nicht mit, und Schätzwerte sind als solche erkennbar.
 */

const orgId = `notif-org-${Date.now()}`;
const userId = `notif-user-${Date.now()}`;

beforeAll(async () => {
  const { adminDb } = await import("@/server/db/client");
  const { organization, user, member } = await import("@/server/db/schema");
  await adminDb.insert(organization).values({
    id: orgId,
    name: "Notification Test Org",
    slug: orgId,
    createdAt: new Date(),
  });
  await adminDb.insert(user).values({
    id: userId,
    name: "Notification Tester",
    email: `${userId}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await adminDb.insert(member).values({
    id: `mem-${userId}`,
    organizationId: orgId,
    userId,
    role: "owner",
    createdAt: new Date(),
  });
});

afterAll(async () => {
  const { adminDb } = await import("@/server/db/client");
  const { organization, user } = await import("@/server/db/schema");
  await adminDb.delete(organization).where(eq(organization.id, orgId));
  await adminDb.delete(user).where(eq(user.id, userId));
});

describe("Benachrichtigungen", () => {
  it("legt zurückhaltende Standardeinstellungen an", async () => {
    const { getOrCreatePreference, ALL_TYPE_KEYS } =
      await import("@/server/notifications/service");
    const pref = await getOrCreatePreference(orgId, userId);
    // In-App für alles, E-Mail nur für Anlässe, die ein Eingreifen erfordern.
    expect(pref.inAppTypes.sort()).toEqual([...ALL_TYPE_KEYS].sort());
    expect(pref.emailTypes).toContain("approval_required");
    expect(pref.emailTypes).not.toContain("workflow_completed");
    expect(pref.dailyDigest).toBe(false);

    // Idempotent
    const again = await getOrCreatePreference(orgId, userId);
    expect(again.id).toBe(pref.id);
  });

  it("legt E-Mails ohne SMTP im Postausgang ab, statt Versand vorzutäuschen", async () => {
    const { notify } = await import("@/server/notifications/service");
    const { adminDb } = await import("@/server/db/client");
    const { mailOutbox } = await import("@/server/db/schema");

    const result = await notify({
      organizationId: orgId,
      userId,
      type: "approval_required",
      title: "Testfreigabe",
      body: "Bitte entscheiden.",
      href: "/app/approvals",
    });

    expect(result.inApp).toBe(true);
    expect(result.email).toBe("outbox");

    const stored = await adminDb
      .select()
      .from(mailOutbox)
      .where(eq(mailOutbox.organizationId, orgId));
    expect(stored.length).toBe(1);
    expect(stored[0]!.status).toBe("stored");
    expect(stored[0]!.subject).toBe("Testfreigabe");
  });

  it("respektiert abgewählte Anlässe", async () => {
    const { notify, updatePreference } =
      await import("@/server/notifications/service");
    await updatePreference({
      organizationId: orgId,
      userId,
      inAppTypes: ["approval_required"],
      emailTypes: [],
      dailyDigest: false,
      digestHour: "08:00",
    });

    const result = await notify({
      organizationId: orgId,
      userId,
      type: "workflow_completed",
      title: "Sollte nicht erscheinen",
    });
    expect(result.inApp).toBe(false);
    expect(result.email).toBe("skipped");
  });

  it("verwirft unbekannte Typen beim Speichern der Einstellungen", async () => {
    const { updatePreference, getOrCreatePreference } =
      await import("@/server/notifications/service");
    await updatePreference({
      organizationId: orgId,
      userId,
      inAppTypes: ["approval_required", "erfundener_typ"],
      emailTypes: ["approval_required"],
      dailyDigest: false,
      digestHour: "99:99",
    });
    const pref = await getOrCreatePreference(orgId, userId);
    expect(pref.inAppTypes).toEqual(["approval_required"]);
    // Ungültige Uhrzeit fällt auf den Standard zurück.
    expect(pref.digestHour).toBe("08:00");
  });

  it("versendet keine leere Tageszusammenfassung", async () => {
    const { updatePreference, sendDigest } =
      await import("@/server/notifications/service");
    await updatePreference({
      organizationId: orgId,
      userId,
      inAppTypes: ["approval_required"],
      emailTypes: ["cost_limit"], // Typ, zu dem es keine Meldungen gibt
      dailyDigest: true,
      digestHour: "08:00",
    });
    const result = await sendDigest(orgId, userId);
    expect(result.delivered).toBe(false);
    expect(result.skippedReason).toContain("Keine neuen Meldungen");
  });

  it("bündelt Meldungen in der Tageszusammenfassung", async () => {
    const { notify, updatePreference, sendDigest } =
      await import("@/server/notifications/service");
    await updatePreference({
      organizationId: orgId,
      userId,
      inAppTypes: ["approval_required", "risk_detected"],
      emailTypes: ["approval_required", "risk_detected"],
      dailyDigest: true,
      digestHour: "08:00",
    });

    for (const title of ["Freigabe A", "Freigabe B"]) {
      const r = await notify({
        organizationId: orgId,
        userId,
        type: "approval_required",
        title,
      });
      // Bei aktivierter Zusammenfassung entfällt die Einzelmail.
      expect(r.email).toBe("skipped");
      expect(r.inApp).toBe(true);
    }

    const digest = await sendDigest(orgId, userId);
    expect(digest.items).toBeGreaterThanOrEqual(2);
    expect(digest.delivered).toBe(false); // Outbox statt Versand

    // Zweiter Aufruf: nichts Neues seit dem letzten Versand.
    const again = await sendDigest(orgId, userId);
    expect(again.items).toBe(0);
  });

  it("zählt und markiert ungelesene Meldungen", async () => {
    const { countUnread, markRead } =
      await import("@/server/notifications/service");
    const before = await countUnread(orgId, userId);
    expect(before).toBeGreaterThan(0);

    const marked = await markRead(orgId, userId);
    expect(marked).toBe(before);
    expect(await countUnread(orgId, userId)).toBe(0);
  });

  it("meldet wartende Freigaben aus einem echten Agentenlauf", async () => {
    const { adminDb } = await import("@/server/db/client");
    const { agentInstance } = await import("@/server/db/schema");
    const { getAgentDefinition } = await import("@/server/agents/catalog");
    const { startRun } = await import("@/server/agents/runtime/engine");
    const { updatePreference, listNotifications } =
      await import("@/server/notifications/service");

    await updatePreference({
      organizationId: orgId,
      userId,
      inAppTypes: ["approval_required"],
      emailTypes: [],
      dailyDigest: false,
      digestHour: "08:00",
    });

    const def = getAgentDefinition("task")!;
    const [instance] = await adminDb
      .insert(agentInstance)
      .values({
        organizationId: orgId,
        definitionSlug: "task",
        displayName: def.personaName,
        status: "active",
        allowedTools: [
          ...new Set(def.capabilities.flatMap((c) => c.requiredTools)),
        ],
        responsibleUserId: userId,
      })
      .returning();

    const outcome = await startRun({
      organizationId: orgId,
      instanceId: instance!.id,
      capabilityKey: "task-extraction",
      goal: "Test: Freigabe-Benachrichtigung",
      input: {
        text: "Bitte den Quartalsbericht bis 30.09.2026 erstellen und versenden.",
      },
      trigger: { type: "manual" },
      requestedByUserId: userId,
    });
    expect(outcome.status).toBe("waiting_approval");

    const items = await listNotifications(orgId, userId);
    const approvalNote = items.find((n) => n.type === "approval_required");
    expect(approvalNote, "Freigabe muss gemeldet werden").toBeDefined();
    expect(approvalNote!.href).toBe("/app/approvals");
    expect(approvalNote!.title).toContain("Freigabe erforderlich");
  });

  /*
   * Regression: `notify()` verwarf unbekannte Typschlüssel still. Die Meldung
   * über einen automatisch abgeschalteten Zeitplan ging deshalb verloren, weil
   * `agent_paused` nirgends deklariert war — ohne Fehler, ohne Logeintrag.
   * Ein unbekannter Typ ist ein Programmierfehler und muss auffallen.
   */
  it("weist unbekannte Benachrichtigungstypen zurück, statt sie zu verwerfen", async () => {
    const { notify } = await import("@/server/notifications/service");
    await expect(
      notify({
        organizationId: orgId,
        userId,
        // @ts-expect-error — genau dieser Fall soll auffallen
        type: "gibt_es_nicht",
        title: "Sollte nicht ankommen",
      }),
    ).rejects.toThrow(/Unbekannter Benachrichtigungstyp/);
  });

  it("kennt den Typ für angehaltene Agenten und Zeitpläne", async () => {
    const {
      notify,
      listNotifications,
      updatePreference,
      NOTIFICATION_TYPES,
      NOTIFICATION_TYPE_KEYS,
    } = await import("@/server/notifications/service");
    expect(NOTIFICATION_TYPES.some((t) => t.key === "agent_paused")).toBe(true);

    // Ein früherer Test in dieser Datei hat die Einstellungen eingeschränkt.
    // Die Voraussetzung wird hier ausdrücklich hergestellt, damit der Test die
    // Typ-Registrierung prüft und nicht das Filterverhalten.
    await updatePreference({
      organizationId: orgId,
      userId,
      inAppTypes: [...NOTIFICATION_TYPE_KEYS],
      emailTypes: [],
      dailyDigest: false,
      digestHour: "08:00",
    });

    await notify({
      organizationId: orgId,
      userId,
      type: "agent_paused",
      title: "Zeitplan automatisch abgeschaltet",
      body: "Fünf Fehlläufe in Folge.",
    });
    const items = await listNotifications(orgId, userId);
    expect(items.some((n) => n.type === "agent_paused")).toBe(true);
  });
});

describe("Berichte", () => {
  it("schließt Sandbox-Läufe aus und weist Schätzungen aus", async () => {
    const { loadReport } = await import("@/server/reports/service");
    const { adminDb } = await import("@/server/db/client");
    const { agentInstance } = await import("@/server/db/schema");
    const { startRun } = await import("@/server/agents/runtime/engine");

    const [instance] = await adminDb
      .select()
      .from(agentInstance)
      .where(eq(agentInstance.organizationId, orgId));

    const before = await loadReport(orgId, 30);

    await startRun({
      organizationId: orgId,
      instanceId: instance!.id,
      capabilityKey: "task-extraction",
      goal: "Berichtstest: Sandbox-Lauf",
      input: { text: "Bitte etwas bis 30.09.2026 prüfen." },
      trigger: { type: "test" },
      sandbox: true,
      requestedByUserId: userId,
    });

    const after = await loadReport(orgId, 30);
    // Der Sandbox-Lauf taucht im Bericht nicht auf.
    expect(after.stats.totalRuns).toBe(before.stats.totalRuns);

    // Ohne echten KI-Provider sind die Kosten tatsächlich null — der Bericht
    // erklärt das, statt eine Zahl zu erfinden.
    expect(after.stats.totalCostDeciCents).toBe(0);
    expect(after.costsAreZeroBecauseScripted).toBe(true);
  });

  it("lässt KPIs ohne Datengrundlage bewusst leer", async () => {
    const { loadGoals } = await import("@/server/reports/service");
    const goals = await loadGoals(orgId, 30);
    expect(goals.length).toBeGreaterThan(0);
    for (const goal of goals) {
      for (const kpi of goal.kpis) {
        // Jede Kennzahl erklärt ihre Herkunft — auch wenn sie leer bleibt.
        expect(kpi.basis.length, `${goal.slug}:${kpi.key}`).toBeGreaterThan(10);
        if (kpi.value === null) {
          expect(kpi.basis).toMatch(/keine|noch nicht|nicht geschätzt/i);
        }
      }
    }
  });
});
