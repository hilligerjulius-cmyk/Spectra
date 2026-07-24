import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Integrationstests der Abrechnung gegen die Test-DB:
 * serverseitige Preisbildung, enthaltene Plätze, Mengenrabatt, Gutscheine,
 * Verbrauchszählung und das tatsächliche Stoppen von Läufen beim Erreichen
 * des Kontingents. Ohne Stripe-Schlüssel läuft alles über den
 * MockBillingProvider ("Simulierte Abrechnung").
 */

const orgId = `bill-org-${Date.now()}`;
const userId = `bill-user-${Date.now()}`;

async function seedAgents(slugs: string[]) {
  const { adminDb } = await import("@/server/db/client");
  const { agentInstance } = await import("@/server/db/schema");
  const { getAgentDefinition } = await import("@/server/agents/catalog");
  await adminDb
    .delete(agentInstance)
    .where(eq(agentInstance.organizationId, orgId));
  for (const slug of slugs) {
    const def = getAgentDefinition(slug)!;
    await adminDb.insert(agentInstance).values({
      organizationId: orgId,
      definitionSlug: slug,
      displayName: def.personaName,
      status: "active",
      allowedTools: [
        ...new Set(def.capabilities.flatMap((c) => c.requiredTools)),
      ],
      responsibleUserId: userId,
    });
  }
}

describe("Abrechnung", () => {
  beforeAll(async () => {
    const { adminDb } = await import("@/server/db/client");
    const { organization, user } = await import("@/server/db/schema");
    await adminDb.insert(organization).values({
      id: orgId,
      name: "Billing Test Org",
      slug: orgId,
      createdAt: new Date(),
    });
    await adminDb.insert(user).values({
      id: userId,
      name: "Billing Tester",
      email: `${userId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    const { adminDb } = await import("@/server/db/client");
    const { organization, user } = await import("@/server/db/schema");
    await adminDb.delete(organization).where(eq(organization.id, orgId));
    await adminDb.delete(user).where(eq(user.id, userId));
  });

  it("legt beim ersten Aufruf eine 14-tägige Testphase an", async () => {
    const { ensureSubscription } = await import("@/server/billing/service");
    const sub = await ensureSubscription(orgId);
    expect(sub.status).toBe("trialing");
    expect(sub.planKey).toBe("starter");
    expect(sub.trialEndsAt).not.toBeNull();
    const days =
      (sub.trialEndsAt!.getTime() - sub.createdAt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(14);
  });

  it("verrechnet enthaltene Agenten-Plätze und schlägt die Plattformgebühr auf", async () => {
    const { computeBillingSummary } = await import("@/server/billing/service");
    const { getAgentDefinition } = await import("@/server/agents/catalog");
    const { getAgentMonthlyPriceCents } = await import(
      "@/server/billing/pricing"
    );

    // Starter enthält genau einen Agenten-Platz.
    await seedAgents(["task", "email-triage"]);
    const summary = await computeBillingSummary(orgId);

    expect(summary.planKey).toBe("starter");
    expect(summary.agentLines).toHaveLength(2);

    const prices = ["task", "email-triage"].map((s) =>
      getAgentMonthlyPriceCents(getAgentDefinition(s)!),
    );
    const cheapest = Math.min(...prices);
    const expected =
      summary.platformFeeCents + (prices[0]! + prices[1]! - cheapest);
    expect(summary.totalMonthlyCents).toBe(expected);
  });

  it("rechnet deaktivierte Agenten nicht ab", async () => {
    const { adminDb } = await import("@/server/db/client");
    const { agentInstance } = await import("@/server/db/schema");
    const { computeBillingSummary } = await import("@/server/billing/service");

    await seedAgents(["task", "email-triage"]);
    await adminDb
      .update(agentInstance)
      .set({ status: "disabled" })
      .where(eq(agentInstance.definitionSlug, "email-triage"));

    const summary = await computeBillingSummary(orgId);
    expect(summary.billableAgentCount).toBe(1);
    expect(summary.agentLines).toHaveLength(1);
    // Der einzige verbleibende Agent liegt auf dem enthaltenen Platz.
    expect(summary.totalMonthlyCents).toBe(summary.platformFeeCents);
  });

  it("wendet einen gültigen Gutschein an und weist einen ungültigen ab", async () => {
    const { applyCoupon, computeBillingSummary, removeCoupon } = await import(
      "@/server/billing/service"
    );
    await seedAgents(["task", "email-triage"]);

    const bad = await applyCoupon(orgId, "GIBTESNICHT");
    expect(bad.ok).toBe(false);

    const before = await computeBillingSummary(orgId);
    const good = await applyCoupon(orgId, "start20");
    expect(good.ok).toBe(true);

    const after = await computeBillingSummary(orgId);
    expect(after.couponCode).toBe("START20");
    expect(after.couponPercent).toBe(20);
    expect(after.totalMonthlyCents).toBeLessThan(before.totalMonthlyCents);

    await removeCoupon(orgId);
    const reset = await computeBillingSummary(orgId);
    expect(reset.couponCode).toBeNull();
    expect(reset.totalMonthlyCents).toBe(before.totalMonthlyCents);
  });

  it("zählt Agentenläufe und stoppt sie beim Erreichen des Kontingents", async () => {
    const { adminDb, withOrg } = await import("@/server/db/client");
    const { agentInstance, usageRecord } = await import("@/server/db/schema");
    const { currentPeriod, computeBillingSummary } = await import(
      "@/server/billing/service"
    );
    const { startRun, QuotaExceededError } = await import(
      "@/server/agents/runtime/engine"
    );

    await seedAgents(["task"]);
    const [instance] = await adminDb
      .select()
      .from(agentInstance)
      .where(eq(agentInstance.organizationId, orgId));

    const before = await computeBillingSummary(orgId);
    const runsBefore = before.usage.runs.used;

    await startRun({
      organizationId: orgId,
      instanceId: instance!.id,
      capabilityKey: "task-extraction",
      goal: "Abrechnungstest: Verbrauch zählen",
      input: { text: "Bitte den Bericht bis 30.09.2026 erstellen." },
      trigger: { type: "manual" },
      requestedByUserId: userId,
    });

    const after = await computeBillingSummary(orgId);
    expect(after.usage.runs.used).toBe(runsBefore + 1);

    // Kontingent künstlich ausschöpfen → nächster Lauf wird abgelehnt.
    await withOrg(orgId, (tx) =>
      tx
        .update(usageRecord)
        .set({ value: after.usage.runs.included })
        .where(eq(usageRecord.period, currentPeriod())),
    );

    await expect(
      startRun({
        organizationId: orgId,
        instanceId: instance!.id,
        capabilityKey: "task-extraction",
        goal: "Abrechnungstest: Lauf über Kontingent",
        input: { text: "Noch eine Aufgabe bis 30.09.2026." },
        trigger: { type: "manual" },
        requestedByUserId: userId,
      }),
    ).rejects.toBeInstanceOf(QuotaExceededError);

    // Sandbox-Läufe bleiben trotz ausgeschöpftem Kontingent möglich.
    const sandboxOutcome = await startRun({
      organizationId: orgId,
      instanceId: instance!.id,
      capabilityKey: "task-extraction",
      goal: "Abrechnungstest: Sandbox trotz Limit",
      input: { text: "Sandbox-Aufgabe bis 30.09.2026." },
      trigger: { type: "sandbox_test" },
      sandbox: true,
      requestedByUserId: userId,
    });
    expect(["completed", "waiting_approval"]).toContain(sandboxOutcome.status);

    const withSandbox = await computeBillingSummary(orgId);
    // Der Sandbox-Lauf hat den Zähler nicht erhöht.
    expect(withSandbox.usage.runs.used).toBe(withSandbox.usage.runs.included);
    expect(withSandbox.limitReached).toBe(true);
  });

  it("erzeugt eine Rechnung genau einmal je Periode (append-only)", async () => {
    const { issueInvoice, listInvoices } = await import(
      "@/server/billing/service"
    );
    const params = {
      organizationId: orgId,
      organizationName: "Billing Test Org",
      contactEmail: `${userId}@example.com`,
    };
    const first = await issueInvoice(params);
    expect(first.ok).toBe(true);

    const second = await issueInvoice(params);
    expect(second.ok).toBe(false);
    expect(second.message).toContain("bereits");

    const invoices = await listInvoices(orgId);
    expect(invoices).toHaveLength(1);
    expect(invoices[0]!.provider).toBe("mock");
    expect(invoices[0]!.lineItems.length).toBeGreaterThan(0);
  });

  it("meldet ohne Stripe-Schlüssel ehrlich eine simulierte Abrechnung", async () => {
    const { billingProviderInfo } = await import("@/server/billing/service");
    const info = billingProviderInfo();
    expect(info.key).toBe("mock");
    expect(info.isReal).toBe(false);
    expect(info.statusNote).toContain("keine echte Zahlung");
  });
});
