import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

/**
 * RLS-Tests: Die App-Rolle (workforce_app) darf ausschließlich Zeilen der
 * Organisation sehen, die per `withOrg()` gesetzt wurde. Cross-Tenant-Lese-
 * und -Schreibzugriffe müssen von PostgreSQL selbst verhindert werden.
 */

const orgA = `rls-test-a-${Date.now()}`;
const orgB = `rls-test-b-${Date.now()}`;
const rlsUser = `rls-user-${Date.now()}`;

/** Drizzle verpackt DB-Fehler ("Failed query"); die Postgres-Meldung liegt in cause. */
async function expectDbError(p: Promise<unknown>, pattern: RegExp) {
  let err: unknown;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  expect(err, "Es wurde ein Datenbankfehler erwartet").toBeTruthy();
  const cause = (err as { cause?: unknown }).cause;
  const full = `${err instanceof Error ? err.message : String(err)} ${
    cause instanceof Error ? cause.message : String(cause ?? "")
  }`;
  expect(full).toMatch(pattern);
}

describe("Row Level Security — Mandantentrennung", () => {
  beforeAll(async () => {
    const { adminDb } = await import("@/server/db/client");
    const { organization, auditLog, user } = await import("@/server/db/schema");
    await adminDb.insert(organization).values([
      { id: orgA, name: "RLS Org A", slug: orgA, createdAt: new Date() },
      { id: orgB, name: "RLS Org B", slug: orgB, createdAt: new Date() },
    ]);
    await adminDb.insert(user).values({
      id: rlsUser,
      name: "RLS Tester",
      email: `${rlsUser}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await adminDb.insert(auditLog).values([
      {
        organizationId: orgA,
        actorType: "system",
        actorLabel: "test",
        action: "test.a",
        summary: "Eintrag Org A",
      },
      {
        organizationId: orgB,
        actorType: "system",
        actorLabel: "test",
        action: "test.b",
        summary: "Eintrag Org B",
      },
    ]);
  });

  afterAll(async () => {
    const { adminDb } = await import("@/server/db/client");
    await adminDb.execute(
      sql`delete from organization where id in (${orgA}, ${orgB})`,
    );
    await adminDb.execute(sql`delete from "user" where id = ${rlsUser}`);
  });

  it("withOrg(A) sieht nur Zeilen von Org A", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { auditLog } = await import("@/server/db/schema");
    const rows = await withOrg(orgA, (tx) => tx.select().from(auditLog));
    expect(rows.length).toBe(1);
    expect(rows[0]!.organizationId).toBe(orgA);
  });

  it("App-Rolle ohne Org-Kontext sieht keine Zeilen", async () => {
    const { db } = await import("@/server/db/client");
    const { auditLog } = await import("@/server/db/schema");
    const rows = await db.select().from(auditLog);
    expect(rows.length).toBe(0);
  });

  it("Insert für fremde Organisation wird von RLS blockiert", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { auditLog } = await import("@/server/db/schema");
    await expectDbError(
      withOrg(orgA, (tx) =>
        tx.insert(auditLog).values({
          organizationId: orgB, // Cross-Tenant-Schreibversuch
          actorType: "system",
          actorLabel: "attacker",
          action: "test.cross",
          summary: "Darf nicht gelingen",
        }),
      ),
      /row-level security/i,
    );
  });

  it("App-Rolle kann Audit-Einträge weder ändern noch löschen (append-only)", async () => {
    const { withOrg } = await import("@/server/db/client");
    await expectDbError(
      withOrg(orgA, (tx) =>
        tx.execute(sql`delete from audit_log where organization_id = ${orgA}`),
      ),
      /permission denied/i,
    );
    await expectDbError(
      withOrg(orgA, (tx) =>
        tx.execute(sql`update audit_log set summary = 'x' where organization_id = ${orgA}`),
      ),
      /permission denied/i,
    );
  });

  it("App-Rolle hat keinerlei Zugriff auf Auth-Tabellen", async () => {
    const { withOrg } = await import("@/server/db/client");
    await expectDbError(
      withOrg(orgA, (tx) => tx.execute(sql`select * from "user"`)),
      /permission denied/i,
    );
    await expectDbError(
      withOrg(orgA, (tx) => tx.execute(sql`select * from "session"`)),
      /permission denied/i,
    );
  });

  it("Abos und Verbrauch sind zwischen Mandanten isoliert", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { subscription, usageRecord } = await import("@/server/db/schema");
    const { ensureSubscription, recordUsage } = await import(
      "@/server/billing/service"
    );

    await ensureSubscription(orgA);
    await ensureSubscription(orgB);
    await recordUsage(orgA, "agent_run", 7);

    const subsA = await withOrg(orgA, (tx) => tx.select().from(subscription));
    expect(subsA).toHaveLength(1);
    expect(subsA[0]!.organizationId).toBe(orgA);

    const usageB = await withOrg(orgB, (tx) => tx.select().from(usageRecord));
    expect(usageB).toHaveLength(0);

    await expectDbError(
      withOrg(orgB, (tx) =>
        tx.insert(usageRecord).values({
          organizationId: orgA, // Cross-Tenant-Schreibversuch
          period: "2026-01",
          metric: "agent_run",
          value: 999,
        }),
      ),
      /row-level security/i,
    );
  });

  it("Rechnungen sind append-only und Pläne für die App-Rolle nur lesbar", async () => {
    const { withOrg } = await import("@/server/db/client");
    await expectDbError(
      withOrg(orgA, (tx) =>
        tx.execute(sql`delete from invoice_record where organization_id = ${orgA}`),
      ),
      /permission denied/i,
    );
    await expectDbError(
      withOrg(orgA, (tx) =>
        tx.execute(sql`update plan set monthly_price_cents = 1`),
      ),
      /permission denied/i,
    );
  });

  it("Einrichtungszustand ist zwischen Mandanten isoliert", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { onboardingState } = await import("@/server/db/schema");
    const { getOrCreateOnboarding } = await import(
      "@/server/onboarding/service"
    );

    await getOrCreateOnboarding(orgA, rlsUser);
    const rowsB = await withOrg(orgB, (tx) =>
      tx.select().from(onboardingState),
    );
    expect(rowsB).toHaveLength(0);

    await expectDbError(
      withOrg(orgB, (tx) =>
        tx.insert(onboardingState).values({ organizationId: orgA }),
      ),
      /row-level security/i,
    );
  });
});
