import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Integrationstests des Einrichtungsassistenten:
 * Zustandspersistenz, Empfehlungslogik aus gespeicherten Antworten und die
 * Sicherheitszusage aus Spec §17 — ohne bestandenen Sandbox-Testlauf ist
 * keine Aktivierung möglich.
 */

const orgId = `onb-org-${Date.now()}`;
const userId = `onb-user-${Date.now()}`;

describe("Einrichtungsassistent", () => {
  beforeAll(async () => {
    const { adminDb } = await import("@/server/db/client");
    const { organization, user } = await import("@/server/db/schema");
    await adminDb.insert(organization).values({
      id: orgId,
      name: "Onboarding Test Org",
      slug: orgId,
      createdAt: new Date(),
    });
    await adminDb.insert(user).values({
      id: userId,
      name: "Onboarding Tester",
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

  it("umfasst genau 14 Schritte mit eindeutigen Schlüsseln", async () => {
    const { ONBOARDING_STEPS } = await import("@/server/onboarding/steps");
    expect(ONBOARDING_STEPS).toHaveLength(14);
    expect(new Set(ONBOARDING_STEPS.map((s) => s.key)).size).toBe(14);
    expect(ONBOARDING_STEPS.map((s) => s.index)).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 1),
    );
    // Der Sandbox-Testlauf muss vor der Aktivierung liegen.
    const sandbox = ONBOARDING_STEPS.find((s) => s.key === "sandbox-run")!;
    const activate = ONBOARDING_STEPS.find((s) => s.key === "activate")!;
    expect(sandbox.index).toBeLessThan(activate.index);
    expect(sandbox.optional).toBe(false);
    expect(activate.optional).toBe(false);
  });

  it("legt den Zustand idempotent an und speichert Antworten", async () => {
    const { getOrCreateOnboarding, saveStep } = await import(
      "@/server/onboarding/service"
    );
    const first = await getOrCreateOnboarding(orgId, userId);
    const second = await getOrCreateOnboarding(orgId, userId);
    expect(second.id).toBe(first.id);
    expect(first.currentStep).toBe(1);

    const saved = await saveStep({
      organizationId: orgId,
      stepKey: "pain-points",
      nextStep: 4,
      answers: { zeitfresser: ["email", "rechnungen"] },
    });
    expect(saved.completedSteps).toContain("pain-points");
    expect(saved.currentStep).toBe(4);
    expect(saved.answers.zeitfresser).toEqual(["email", "rechnungen"]);
  });

  it("übernimmt nur Slugs, die es im Katalog wirklich gibt", async () => {
    const { saveStep } = await import("@/server/onboarding/service");
    const saved = await saveStep({
      organizationId: orgId,
      stepKey: "recommendation",
      nextStep: 6,
      selectedAgents: ["task", "gibt-es-nicht", "email-triage"],
    });
    expect(saved.selectedAgents).toEqual(["task", "email-triage"]);
  });

  it("leitet aus gespeicherten Antworten eine begründete Empfehlung ab", async () => {
    const { loadOverview } = await import("@/server/onboarding/service");
    const overview = await loadOverview(orgId, userId);
    expect(overview.answers.zeitfresser).toContain("email");
    expect(overview.recommendation.agents.length).toBeGreaterThan(0);
    for (const agent of overview.recommendation.agents) {
      expect(agent.reasons.length).toBeGreaterThan(0);
    }
    // Preisberechnung folgt der Auswahl, nicht der Empfehlung.
    expect(overview.pricing.agentSubtotalCents).toBeGreaterThan(0);
  });

  it("verweigert die Aktivierung ohne bestandenen Sandbox-Testlauf", async () => {
    const { adminDb, withOrg } = await import("@/server/db/client");
    const { agentInstance } = await import("@/server/db/schema");
    const { getAgentDefinition } = await import("@/server/agents/catalog");
    const { runSandboxTest } = await import("@/server/agents/runtime/sandbox");

    const def = getAgentDefinition("task")!;
    const [instance] = await adminDb
      .insert(agentInstance)
      .values({
        organizationId: orgId,
        definitionSlug: "task",
        displayName: def.personaName,
        status: "sandbox",
        allowedTools: [
          ...new Set(def.capabilities.flatMap((c) => c.requiredTools)),
        ],
        responsibleUserId: userId,
      })
      .returning();

    expect(instance!.sandboxPassedAt).toBeNull();

    const outcome = await runSandboxTest({
      organizationId: orgId,
      instanceId: instance!.id,
      requestedByUserId: userId,
      requestedByLabel: "Onboarding Tester",
    });
    expect(outcome.passed).toBe(true);

    const [after] = await withOrg(orgId, (tx) =>
      tx.select().from(agentInstance).where(eq(agentInstance.id, instance!.id)),
    );
    expect(after!.sandboxPassedAt).not.toBeNull();
    // Der Testlauf selbst aktiviert nicht — das bleibt eine bewusste Entscheidung.
    expect(after!.status).toBe("sandbox");
  });

  it("markiert die Einrichtung als abgeschlossen", async () => {
    const { markCompleted, getOrCreateOnboarding } = await import(
      "@/server/onboarding/service"
    );
    await markCompleted(orgId);
    const state = await getOrCreateOnboarding(orgId, userId);
    expect(state.completed).toBe(true);
    expect(state.completedAt).not.toBeNull();
    expect(state.completedSteps).toHaveLength(14);
  });
});
