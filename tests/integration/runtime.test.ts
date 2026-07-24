import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Integrationstests der Agent-Runtime gegen die Test-DB:
 * Automatisierungsstufen, Freigabe-Flow (Prepared Action), Tool-Berechtigungen,
 * Idempotenz und Sandbox-Testlauf. KI-Aufrufe laufen deterministisch über den
 * ScriptedProvider (kein API-Key nötig).
 */

const orgId = `rt-org-${Date.now()}`;
const userId = `rt-user-${Date.now()}`;

async function createInstance(overrides: Partial<Record<string, unknown>> = {}) {
  const { adminDb } = await import("@/server/db/client");
  const { agentInstance } = await import("@/server/db/schema");
  const { getAgentDefinition } = await import("@/server/agents/catalog");
  const def = getAgentDefinition("task")!;
  // Eine Instanz je Agent und Org (Unique-Constraint) — alte Testinstanz ersetzen
  const { and, eq: eqOp } = await import("drizzle-orm");
  await adminDb
    .delete(agentInstance)
    .where(
      and(
        eqOp(agentInstance.organizationId, orgId),
        eqOp(agentInstance.definitionSlug, "task"),
      ),
    );
  const [row] = await adminDb
    .insert(agentInstance)
    .values({
      organizationId: orgId,
      definitionSlug: "task",
      displayName: "Theo (Test)",
      status: "active",
      allowedTools: [...new Set(def.capabilities.flatMap((c) => c.requiredTools))],
      responsibleUserId: userId,
      ...overrides,
    })
    .returning();
  return row!;
}

describe("Agent-Runtime", () => {
  beforeAll(async () => {
    const { adminDb } = await import("@/server/db/client");
    const { organization, user } = await import("@/server/db/schema");
    await adminDb.insert(organization).values({
      id: orgId,
      name: "Runtime Test Org",
      slug: orgId,
      createdAt: new Date(),
    });
    await adminDb.insert(user).values({
      id: userId,
      name: "Runtime Tester",
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

  it("Stufe 3: Lauf wartet auf Freigabe; Genehmigung führt die Aktion aus", async () => {
    const { startRun } = await import("@/server/agents/runtime/engine");
    const { decideApproval } = await import("@/server/agents/runtime/approvals");
    const { withOrg } = await import("@/server/db/client");
    const { approvalRequest, task, agentRun, agentStep } = await import("@/server/db/schema");

    const instance = await createInstance(); // task-extraction default: Stufe 3

    const outcome = await startRun({
      organizationId: orgId,
      instanceId: instance.id,
      capabilityKey: "task-extraction",
      goal: "Test: Aufgaben aus Protokoll extrahieren",
      input: {
        text: "Bitte den Quartalsbericht bis 30.08.2026 erstellen und an die Geschäftsführung senden.",
        sourceType: "protokoll",
      },
      trigger: { type: "manual" },
      requestedByUserId: userId,
    });

    expect(outcome.status).toBe("waiting_approval");

    const approvals = await withOrg(orgId, (tx) =>
      tx.select().from(approvalRequest).where(eq(approvalRequest.runId, outcome.runId)),
    );
    expect(approvals.length).toBeGreaterThanOrEqual(1);
    expect(approvals[0]!.actionType).toBe("task.create");
    expect(approvals[0]!.status).toBe("pending");
    expect(approvals[0]!.reasoning.length).toBeGreaterThan(10);

    // Vor der Freigabe: keine Aufgabe angelegt
    const tasksBefore = await withOrg(orgId, (tx) => tx.select().from(task));
    expect(tasksBefore).toHaveLength(0);

    // Alle Freigaben genehmigen → Aktionen werden ausgeführt, Lauf abgeschlossen
    for (const approval of approvals) {
      const decision = await decideApproval({
        organizationId: orgId,
        approvalId: approval.id,
        userId,
        userLabel: "Runtime Tester",
        decision: "approve",
      });
      expect(decision.ok).toBe(true);
    }

    const tasksAfter = await withOrg(orgId, (tx) => tx.select().from(task));
    expect(tasksAfter.length).toBe(approvals.length);
    expect(tasksAfter[0]!.createdByType).toBe("agent");

    const [runRow] = await withOrg(orgId, (tx) =>
      tx.select().from(agentRun).where(eq(agentRun.id, outcome.runId)),
    );
    expect(runRow!.status).toBe("completed");

    const steps = await withOrg(orgId, (tx) =>
      tx.select().from(agentStep).where(eq(agentStep.runId, outcome.runId)),
    );
    const phases = steps.map((s) => s.phase);
    expect(phases).toContain("plan");
    expect(phases).toContain("request_approval");
    expect(phases).toContain("execute");

    // Aufräumen für Folgetests
    await withOrg(orgId, (tx) => tx.delete(task));
  });

  it("Ablehnung: keine Aufgabe wird angelegt, Lauf wird abgeschlossen", async () => {
    const { startRun } = await import("@/server/agents/runtime/engine");
    const { decideApproval } = await import("@/server/agents/runtime/approvals");
    const { withOrg } = await import("@/server/db/client");
    const { approvalRequest, task, agentRun } = await import("@/server/db/schema");

    const instance = await createInstance();
    const outcome = await startRun({
      organizationId: orgId,
      instanceId: instance.id,
      capabilityKey: "task-extraction",
      goal: "Test: Ablehnung",
      input: { text: "Bitte die Unterlagen bis 01.09.2026 prüfen und freigeben." },
      trigger: { type: "manual" },
      requestedByUserId: userId,
    });
    expect(outcome.status).toBe("waiting_approval");

    const approvals = await withOrg(orgId, (tx) =>
      tx.select().from(approvalRequest).where(eq(approvalRequest.runId, outcome.runId)),
    );
    for (const approval of approvals) {
      const decision = await decideApproval({
        organizationId: orgId,
        approvalId: approval.id,
        userId,
        userLabel: "Runtime Tester",
        decision: "reject",
        note: "Nicht relevant",
      });
      expect(decision.ok).toBe(true);
    }

    const tasks = await withOrg(orgId, (tx) => tx.select().from(task));
    expect(tasks).toHaveLength(0);

    const [runRow] = await withOrg(orgId, (tx) =>
      tx.select().from(agentRun).where(eq(agentRun.id, outcome.runId)),
    );
    expect(runRow!.status).toBe("completed");
    expect(runRow!.summary).toMatch(/abgelehnt/);
  });

  it("Stufe 4: risikoarme Aktion wird direkt ausgeführt", async () => {
    const { startRun } = await import("@/server/agents/runtime/engine");
    const { withOrg } = await import("@/server/db/client");
    const { task } = await import("@/server/db/schema");

    const instance = await createInstance({
      automationOverrides: { "task-extraction": 4 },
    });
    const outcome = await startRun({
      organizationId: orgId,
      instanceId: instance.id,
      capabilityKey: "task-extraction",
      goal: "Test: autonome Ausführung",
      input: { text: "Dringend: Bitte Serverwartung vorbereiten und Termin bestätigen." },
      trigger: { type: "manual" },
      requestedByUserId: userId,
    });
    expect(outcome.status).toBe("completed");
    const tasks = await withOrg(orgId, (tx) => tx.select().from(task));
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    await withOrg(orgId, (tx) => tx.delete(task));
  });

  it("Stufe 0: deaktivierte Fähigkeit führt nichts aus", async () => {
    const { startRun } = await import("@/server/agents/runtime/engine");
    const instance = await createInstance({
      disabledCapabilities: ["task-extraction"],
    });
    const outcome = await startRun({
      organizationId: orgId,
      instanceId: instance.id,
      capabilityKey: "task-extraction",
      goal: "Test: deaktiviert",
      input: { text: "Bitte etwas erstellen." },
      trigger: { type: "manual" },
    });
    expect(outcome.status).toBe("completed");
    expect(outcome.summary).toMatch(/deaktiviert/);
  });

  it("Tool-Berechtigung: ohne freigegebenes Tool schlägt die Ausführung fehl", async () => {
    const { startRun } = await import("@/server/agents/runtime/engine");
    const instance = await createInstance({
      automationOverrides: { "task-extraction": 4 },
      allowedTools: ["email.read"], // tasks.write fehlt bewusst
    });
    const outcome = await startRun({
      organizationId: orgId,
      instanceId: instance.id,
      capabilityKey: "task-extraction",
      goal: "Test: Tool verweigert",
      input: { text: "Bitte Bericht erstellen und senden." },
      trigger: { type: "manual" },
    });
    expect(outcome.status).toBe("failed");
    expect(outcome.summary).toMatch(/nicht freigegeben/);
  });

  it("Idempotenz: gleicher Schlüssel führt nicht doppelt aus", async () => {
    const { startRun } = await import("@/server/agents/runtime/engine");
    const instance = await createInstance({
      automationOverrides: { "task-extraction": 2 },
    });
    const key = `idem-${Date.now()}`;
    const first = await startRun({
      organizationId: orgId,
      instanceId: instance.id,
      capabilityKey: "task-extraction",
      goal: "Test: Idempotenz",
      input: { text: "Bitte Konzept erstellen." },
      trigger: { type: "event" },
      idempotencyKey: key,
    });
    const second = await startRun({
      organizationId: orgId,
      instanceId: instance.id,
      capabilityKey: "task-extraction",
      goal: "Test: Idempotenz (Wiederholung)",
      input: { text: "Bitte Konzept erstellen." },
      trigger: { type: "event" },
      idempotencyKey: key,
    });
    expect(second.runId).toBe(first.runId);
  });

  it("Pausierte Agenten führen keine Läufe aus", async () => {
    const { startRun } = await import("@/server/agents/runtime/engine");
    const instance = await createInstance({ status: "paused" });
    await expect(
      startRun({
        organizationId: orgId,
        instanceId: instance.id,
        capabilityKey: "task-extraction",
        goal: "Test: pausiert",
        input: { text: "x" },
        trigger: { type: "manual" },
      }),
    ).rejects.toThrow(/pausiert/);
  });

  it("Sandbox-Testlauf setzt sandboxPassedAt", async () => {
    const { runSandboxTest } = await import("@/server/agents/runtime/sandbox");
    const { adminDb } = await import("@/server/db/client");
    const { agentInstance } = await import("@/server/db/schema");

    const instance = await createInstance({ status: "sandbox" });
    const outcome = await runSandboxTest({
      organizationId: orgId,
      instanceId: instance.id,
      requestedByUserId: userId,
      requestedByLabel: "Runtime Tester",
    });
    expect(outcome.passed).toBe(true);

    const [row] = await adminDb
      .select({ sandboxPassedAt: agentInstance.sandboxPassedAt })
      .from(agentInstance)
      .where(eq(agentInstance.id, instance.id));
    expect(row!.sandboxPassedAt).not.toBeNull();
  });
});
