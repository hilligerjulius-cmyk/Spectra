import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Belegt, dass **jeder** Agent des Katalogs mit **jeder** seiner Fähigkeiten
 * tatsächlich läuft — nicht nur im Katalog beschrieben ist. Sieben Agenten
 * nutzen dabei vertiefte Handler, alle übrigen die Archetyp-Handler.
 *
 * Jeder Lauf muss einen verwertbaren Zustand erreichen (abgeschlossen oder
 * wartend auf Freigabe), mindestens zwei Schritte protokollieren und eine
 * belastbare Zusammenfassung liefern. Deterministisch über den
 * ScriptedProvider; kein API-Key nötig.
 */

const orgId = `dept-org-${Date.now()}`;
const userId = `dept-user-${Date.now()}`;

const SAMPLE_INPUT = [
  "Vorgang vom 12.08.2026, Beispiel GmbH, Ansprechperson kontakt@beispiel.de.",
  "Der Gesamtbetrag liegt bei 4.760,00 EUR. Die Rückmeldung ist überfällig.",
  "Bitte den Statusbericht bis 30.09.2026 erstellen und die offenen Punkte klären.",
  "Dringend: Die Freigabe für das Budget fehlt noch.",
].join("\n");

/** Legt für jeden Katalogagenten eine Instanz an (einmalig je Suite). */
async function seedAllAgents(): Promise<Map<string, string>> {
  const { adminDb } = await import("@/server/db/client");
  const { agentInstance } = await import("@/server/db/schema");
  const { agentCatalog } = await import("@/server/agents/catalog");

  const ids = new Map<string, string>();
  for (const def of agentCatalog) {
    const [row] = await adminDb
      .insert(agentInstance)
      .values({
        organizationId: orgId,
        definitionSlug: def.slug,
        displayName: def.personaName,
        status: "active",
        allowedTools: [
          ...new Set(def.capabilities.flatMap((c) => c.requiredTools)),
        ],
        responsibleUserId: userId,
      })
      .returning({ id: agentInstance.id });
    ids.set(def.slug, row!.id);
  }
  return ids;
}

let instanceIds: Map<string, string>;

describe("Departments — der gesamte Katalog läuft", () => {
  beforeAll(async () => {
    const { adminDb } = await import("@/server/db/client");
    const { organization, user } = await import("@/server/db/schema");
    await adminDb.insert(organization).values({
      id: orgId,
      name: "Departments Test Org",
      slug: orgId,
      createdAt: new Date(),
    });
    await adminDb.insert(user).values({
      id: userId,
      name: "Departments Tester",
      email: `${userId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    instanceIds = await seedAllAgents();
  });

  afterAll(async () => {
    const { adminDb } = await import("@/server/db/client");
    const { organization, user } = await import("@/server/db/schema");
    await adminDb.delete(organization).where(eq(organization.id, orgId));
    await adminDb.delete(user).where(eq(user.id, userId));
  });

  it("umfasst 57 Agenten über acht Departments", async () => {
    const { agentCatalog, departments } = await import(
      "@/server/agents/catalog"
    );
    expect(agentCatalog.length).toBe(57);
    expect(Object.keys(departments).length).toBe(8);
    const covered = new Set(agentCatalog.map((a) => a.department));
    expect(covered.size).toBe(8);
    expect(instanceIds.size).toBe(agentCatalog.length);
  });

  it("führt jede Fähigkeit jedes Agenten real aus", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { agentStep, agentRun } = await import("@/server/db/schema");
    const { agentCatalog } = await import("@/server/agents/catalog");
    const { startRun } = await import("@/server/agents/runtime/engine");

    const failures: string[] = [];
    let runsExecuted = 0;

    for (const def of agentCatalog) {
      for (const capability of def.capabilities) {
        const outcome = await startRun({
          organizationId: orgId,
          instanceId: instanceIds.get(def.slug)!,
          capabilityKey: capability.key,
          goal: `Departmenttest: ${capability.name}`,
          input: { text: SAMPLE_INPUT },
          trigger: { type: "test" },
          sandbox: true,
          requestedByUserId: userId,
        });
        runsExecuted++;

        if (!["completed", "waiting_approval"].includes(outcome.status)) {
          const [run] = await withOrg(orgId, (tx) =>
            tx.select().from(agentRun).where(eq(agentRun.id, outcome.runId)),
          );
          failures.push(
            `${def.slug}:${capability.key} → ${outcome.status} (${run?.error ?? outcome.summary})`,
          );
          continue;
        }

        // Ein Lauf ohne Schritte wäre eine Attrappe.
        const steps = await withOrg(orgId, (tx) =>
          tx.select().from(agentStep).where(eq(agentStep.runId, outcome.runId)),
        );
        if (steps.length < 2) {
          failures.push(
            `${def.slug}:${capability.key} → nur ${steps.length} Schritt(e) protokolliert`,
          );
        }
        if (!outcome.summary || outcome.summary.length < 10) {
          failures.push(
            `${def.slug}:${capability.key} → keine belastbare Zusammenfassung`,
          );
        }
      }
    }

    expect(failures, `\n${failures.join("\n")}\n`).toEqual([]);
    expect(runsExecuted).toBeGreaterThanOrEqual(100);
  }, 300_000);

  it("markiert fehlende Anbindungen, statt Ergebnisse vorzutäuschen", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { agentStep } = await import("@/server/db/schema");
    const { agentCatalog } = await import("@/server/agents/catalog");
    const { startRun } = await import("@/server/agents/runtime/engine");
    const { isToolImplemented } = await import("@/server/agents/runtime/tools");

    // Erste Fähigkeit im Katalog, die auf einen nicht implementierten
    // Connector angewiesen ist — und keinen vertieften Handler hat.
    let target: { slug: string; capabilityKey: string } | null = null;
    for (const def of agentCatalog) {
      if (def.implementationDepth === "deep") continue;
      const cap = def.capabilities.find((c) =>
        c.requiredTools.some((t) => !isToolImplemented(t)),
      );
      if (cap) {
        target = { slug: def.slug, capabilityKey: cap.key };
        break;
      }
    }
    expect(
      target,
      "Erwartet: mindestens eine Fähigkeit mit nicht implementiertem Tool",
    ).not.toBeNull();

    const outcome = await startRun({
      organizationId: orgId,
      instanceId: instanceIds.get(target!.slug)!,
      capabilityKey: target!.capabilityKey,
      goal: "Test: fehlende Anbindung",
      input: { text: SAMPLE_INPUT },
      trigger: { type: "test" },
      sandbox: true,
      requestedByUserId: userId,
    });

    // Der Lauf scheitert nicht — er benennt die Einschränkung.
    expect(["completed", "waiting_approval"]).toContain(outcome.status);

    const steps = await withOrg(orgId, (tx) =>
      tx.select().from(agentStep).where(eq(agentStep.runId, outcome.runId)),
    );
    const note = steps.find((s) =>
      s.title.includes("Anbindung(en) nicht verfügbar"),
    );
    expect(note, "Fehlende Anbindungen müssen protokolliert sein").toBeDefined();
    expect((note!.detail as { tools: string[] }).tools.length).toBeGreaterThan(
      0,
    );
  });

});
