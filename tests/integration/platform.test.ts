import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

/**
 * Plattform-Adminbereich.
 *
 * Kernzusagen, die hier belegt werden:
 *  - Die App-Rolle hat auf die Plattformtabellen keinerlei Rechte; ein Zugriff
 *    aus dem Anwendungskontext ist technisch ausgeschlossen, nicht nur durch
 *    eine Prüfung in der Anwendung verhindert.
 *  - Support-Einblicke sind begründungspflichtig und erscheinen doppelt: im
 *    Plattform-Protokoll und im Audit-Log der betroffenen Organisation.
 *  - Preis-Overrides gelten je (Bereich, Ziel) und schlagen im Ergebnis der
 *    Abrechnung durch.
 */

const orgA = `plat-org-a-${Date.now()}`;
const orgB = `plat-org-b-${Date.now()}`;
const supportUser = `plat-support-${Date.now()}`;

beforeAll(async () => {
  const { adminDb } = await import("@/server/db/client");
  const { organization, user, platformAdmin } = await import(
    "@/server/db/schema"
  );
  await adminDb.insert(organization).values([
    { id: orgA, name: "Plattform Org A", slug: orgA, createdAt: new Date() },
    { id: orgB, name: "Plattform Org B", slug: orgB, createdAt: new Date() },
  ]);
  await adminDb.insert(user).values({
    id: supportUser,
    name: "Support Person",
    email: `${supportUser}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await adminDb
    .insert(platformAdmin)
    .values({ userId: supportUser, level: "support" });
});

afterAll(async () => {
  const { adminDb } = await import("@/server/db/client");
  const { organization, user, priceOverride } = await import(
    "@/server/db/schema"
  );
  await adminDb.delete(organization).where(eq(organization.id, orgA));
  await adminDb.delete(organization).where(eq(organization.id, orgB));
  await adminDb.delete(user).where(eq(user.id, supportUser));
  await adminDb
    .delete(priceOverride)
    .where(eq(priceOverride.scope, "tier"));
});

describe("Plattformtabellen sind für die App-Rolle gesperrt", () => {
  /** Drizzle verpackt DB-Fehler; die Postgres-Meldung liegt in cause. */
  async function expectDenied(p: Promise<unknown>) {
    let err: unknown;
    try {
      await p;
    } catch (e) {
      err = e;
    }
    expect(err, "Es wurde ein Berechtigungsfehler erwartet").toBeTruthy();
    const cause = (err as { cause?: unknown }).cause;
    const full = `${err instanceof Error ? err.message : String(err)} ${
      cause instanceof Error ? cause.message : String(cause ?? "")
    }`;
    expect(full).toMatch(/permission denied/i);
  }

  it("verweigert der App-Rolle jeden Zugriff — auch mit Org-Kontext", async () => {
    const { withOrg } = await import("@/server/db/client");
    for (const table of [
      "platform_admin",
      "support_access_log",
      "feature_flag",
    ]) {
      await expectDenied(
        withOrg(orgA, (tx) => tx.execute(sql.raw(`select * from ${table}`))),
      );
      await expectDenied(
        withOrg(orgA, (tx) =>
          tx.execute(sql.raw(`delete from ${table} where true`)),
        ),
      );
    }
  });
});

describe("Support-Zugriff", () => {
  it("verlangt eine nachvollziehbare Begründung", async () => {
    const { logSupportAccess, PlatformAccessError } = await import(
      "@/server/platform/guards"
    );
    const ctx = {
      userId: supportUser,
      userLabel: "Support Person",
      email: `${supportUser}@example.com`,
      level: "support" as const,
    };
    await expect(
      logSupportAccess({
        ctx,
        organizationId: orgA,
        reason: "kurz",
        scope: "Organisationsdetails",
      }),
    ).rejects.toBeInstanceOf(PlatformAccessError);
  });

  it("protokolliert den Zugriff doppelt — Plattform und Kundin", async () => {
    const { logSupportAccess } = await import("@/server/platform/guards");
    const { withOrg, adminDb } = await import("@/server/db/client");
    const { auditLog, supportAccessLog } = await import("@/server/db/schema");

    const reason = "Supportanfrage #1234: Agentenlauf schlägt fehl.";
    await logSupportAccess({
      ctx: {
        userId: supportUser,
        userLabel: "Support Person",
        email: `${supportUser}@example.com`,
        level: "support",
      },
      organizationId: orgA,
      reason,
      scope: "Organisationsdetails",
    });

    // 1. Plattform-Protokoll (nur über die Owner-Verbindung lesbar)
    const platformRows = await adminDb
      .select()
      .from(supportAccessLog)
      .where(eq(supportAccessLog.organizationId, orgA));
    expect(platformRows).toHaveLength(1);
    expect(platformRows[0]!.reason).toBe(reason);

    // 2. Audit-Log der Organisation — die Kundin sieht den Zugriff selbst
    const auditRows = await withOrg(orgA, (tx) =>
      tx.select().from(auditLog).where(eq(auditLog.action, "support.access")),
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!.summary).toContain(reason);
    expect(auditRows[0]!.actorLabel).toContain("Support");

    // Die andere Organisation sieht davon nichts.
    const otherRows = await withOrg(orgB, (tx) =>
      tx.select().from(auditLog).where(eq(auditLog.action, "support.access")),
    );
    expect(otherRows).toHaveLength(0);
  });
});

describe("Plattform-Auswertungen", () => {
  it("zählt Organisationen ohne Inhalte offenzulegen", async () => {
    const { listOrganizations, loadPlatformStats } = await import(
      "@/server/platform/service"
    );
    const orgs = await listOrganizations();
    const mine = orgs.find((o) => o.id === orgA);
    expect(mine).toBeDefined();
    expect(mine!.name).toBe("Plattform Org A");
    // Die Übersicht liefert ausschließlich Zählungen.
    expect(Object.keys(mine!)).toEqual(
      expect.arrayContaining([
        "memberCount",
        "agentCount",
        "runCount30d",
        "planKey",
      ]),
    );

    const stats = await loadPlatformStats();
    expect(stats.organizations).toBeGreaterThanOrEqual(2);
  });

  it("findet Audit-Einträge organisationsübergreifend und filtert korrekt", async () => {
    const { searchAuditLog } = await import("@/server/platform/service");

    const filtered = await searchAuditLog({
      organizationId: orgA,
      action: "support",
    });
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered.every((e) => e.organizationId === orgA)).toBe(true);
    expect(filtered.every((e) => e.action.includes("support"))).toBe(true);

    const otherOrg = await searchAuditLog({ organizationId: orgB });
    expect(otherOrg.every((e) => e.organizationId === orgB)).toBe(true);
  });

  it("legt die Auslieferungs-Funktionsschalter deaktiviert an", async () => {
    const { listFeatureFlags, isFeatureEnabled } = await import(
      "@/server/platform/service"
    );
    const flags = await listFeatureFlags();
    expect(flags.length).toBeGreaterThanOrEqual(3);
    // Standardmäßig ist nichts freigeschaltet — bewusste Entscheidung.
    expect(flags.every((f) => f.enabled === false)).toBe(true);
    expect(await isFeatureEnabled("scheduled_runs", orgA)).toBe(false);
    expect(await isFeatureEnabled("gibt-es-nicht", orgA)).toBe(false);
  });

  it("begrenzt einen Schalter auf ausgewählte Organisationen", async () => {
    const { adminDb } = await import("@/server/db/client");
    const { featureFlag } = await import("@/server/db/schema");
    const { isFeatureEnabled } = await import("@/server/platform/service");

    await adminDb
      .update(featureFlag)
      .set({ enabled: true, organizationIds: [orgA] })
      .where(eq(featureFlag.key, "advanced_reports"));

    expect(await isFeatureEnabled("advanced_reports", orgA)).toBe(true);
    expect(await isFeatureEnabled("advanced_reports", orgB)).toBe(false);

    // Leere Liste bedeutet: für alle aktiv.
    await adminDb
      .update(featureFlag)
      .set({ organizationIds: [] })
      .where(eq(featureFlag.key, "advanced_reports"));
    expect(await isFeatureEnabled("advanced_reports", orgB)).toBe(true);

    await adminDb
      .update(featureFlag)
      .set({ enabled: false })
      .where(eq(featureFlag.key, "advanced_reports"));
  });
});

describe("Preis-Overrides", () => {
  it("wirken auf die Abrechnung und gelten je Bereich und Ziel", async () => {
    const { adminDb } = await import("@/server/db/client");
    const { priceOverride, agentInstance } = await import(
      "@/server/db/schema"
    );
    const { getAgentDefinition } = await import("@/server/agents/catalog");
    const { computeBillingSummary } = await import("@/server/billing/service");
    const { loadPriceOverview } = await import("@/server/platform/service");

    // Preisstufe aus dem Katalog ableiten, statt sie im Test festzuschreiben —
    // so bleibt der Test gültig, wenn ein Agent umgestuft wird.
    const def = getAgentDefinition("calendar")!;
    const tier = def.priceTier;
    await adminDb.insert(agentInstance).values({
      organizationId: orgA,
      definitionSlug: def.slug,
      displayName: def.personaName,
      status: "active",
      allowedTools: [],
    });

    const before = await computeBillingSummary(orgA);
    const lineBefore = before.agentLines.find((l) => l.key === def.slug);
    expect(lineBefore).toBeDefined();

    // Override auf die Preisstufe des Agenten setzen
    await adminDb.insert(priceOverride).values({
      scope: "tier",
      targetKey: tier,
      monthlyPriceCents: 9900,
    });

    const after = await computeBillingSummary(orgA);
    const lineAfter = after.agentLines.find((l) => l.key === def.slug);
    expect(lineAfter!.monthlyCents).toBe(9900);
    expect(lineAfter!.monthlyCents).not.toBe(lineBefore!.monthlyCents);

    // Die Übersicht im Adminbereich zeigt den Override an.
    const overview = await loadPriceOverview();
    const row = overview.find(
      (r) => r.scope === "tier" && r.targetKey === tier,
    );
    expect(row!.overrideCents).toBe(9900);
    expect(row!.defaultCents).not.toBe(9900);
  });
});
