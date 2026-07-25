import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Die sieben plattforminternen Werkzeuge.
 *
 * Schwerpunkt liegt nicht darauf, dass sie irgendein Ergebnis liefern, sondern
 * auf ihren Selbstbegrenzungen: keine Rekursion bei Delegation, keine
 * Rechteweitergabe, kein Anhalten im Sandbox-Lauf, keine erfundenen Beträge und
 * keine agentengeschriebenen Inhalte, die wie hochgeladene Dokumente aussehen.
 */

let orgId: string;
let userId: string;
/** definitionSlug → instanceId */
const instances = new Map<string, string>();

async function makeInstance(slug: string, status = "active"): Promise<string> {
  const { adminDb } = await import("@/server/db/client");
  const { agentInstance } = await import("@/server/db/schema");
  const { getAgentDefinition } = await import("@/server/agents/catalog");
  const def = getAgentDefinition(slug)!;
  const id = crypto.randomUUID();
  await adminDb.insert(agentInstance).values({
    id,
    organizationId: orgId,
    definitionSlug: slug,
    displayName: def.personaName,
    status,
    allowedTools: [
      ...new Set(def.capabilities.flatMap((c) => c.requiredTools)),
    ],
  });
  instances.set(slug, id);
  return id;
}

beforeAll(async () => {
  const { adminDb } = await import("@/server/db/client");
  const { organization, user } = await import("@/server/db/schema");
  orgId = crypto.randomUUID();
  userId = crypto.randomUUID();
  await adminDb.insert(user).values({
    id: userId,
    name: "Testperson",
    email: `tools-platform-${userId}@example.de`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await adminDb.insert(organization).values({
    id: orgId,
    name: "Werkzeugtest",
    slug: `werkzeugtest-${orgId.slice(0, 8)}`,
    createdAt: new Date(),
  });

  await makeInstance("chief-of-staff");
  await makeInstance("company-memory");
  await makeInstance("monthly-reporting");
  await makeInstance("escalation");
  await makeInstance("proposal");
  await makeInstance("invoice-intake");
  // Bewusst nur in der Sandbox, nicht aktiv — Ziel für die Statusprüfung.
  await makeInstance("task", "sandbox");
});

afterAll(async () => {
  const { adminDb } = await import("@/server/db/client");
  const { organization, user } = await import("@/server/db/schema");
  await adminDb.delete(organization).where(eq(organization.id, orgId));
  await adminDb.delete(user).where(eq(user.id, userId));
});

/** Ruft ein Werkzeug direkt auf, ohne den Umweg über einen Lauf. */
async function callTool(
  key: string,
  slug: string,
  input: unknown,
  opts: { sandbox?: boolean; runId?: string } = {},
) {
  const { getTool } = await import("@/server/agents/runtime/tools");
  await import("@/server/agents/runtime/tools-init");
  const tool = getTool(key);
  if (!tool) throw new Error(`Werkzeug ${key} nicht registriert`);
  return tool.execute(
    {
      organizationId: orgId,
      instanceId: instances.get(slug)!,
      runId: opts.runId ?? crypto.randomUUID(),
      sandbox: opts.sandbox ?? false,
      requestedByUserId: userId,
    },
    input,
  );
}

describe("pricing.calculate", () => {
  it("rechnet Positionen exakt und erfindet keine Beträge", async () => {
    const result = await callTool("pricing.calculate", "proposal", {
      items: [
        { description: "Beratung", quantity: 10, unitPriceCents: 15_000 },
        {
          description: "Workshop",
          quantity: 1,
          unitPriceCents: 200_000,
          discountPercent: 10,
        },
      ],
      vatPercent: 19,
    });
    const d = result.data as {
      netCents: number;
      vatCents: number;
      grossCents: number;
    };
    // 10 × 150,00 = 1500,00 ; 2000,00 − 10 % = 1800,00 → netto 3300,00
    expect(d.netCents).toBe(330_000);
    expect(d.vatCents).toBe(62_700);
    expect(d.grossCents).toBe(392_700);
  });

  it("weist nicht-numerische Beträge ab, statt sie zu schätzen", async () => {
    await expect(
      callTool("pricing.calculate", "proposal", {
        items: [
          { description: "Beratung", quantity: 10, unitPriceCents: "ungefähr 1500" },
        ],
      }),
    ).rejects.toThrow();
  });

  it("weist eine leere Positionsliste ab", async () => {
    await expect(
      callTool("pricing.calculate", "proposal", { items: [] }),
    ).rejects.toThrow();
  });

  it("nennt den Steuersatz als übernommen, nicht als geprüft", async () => {
    const result = await callTool("pricing.calculate", "proposal", {
      items: [{ description: "Posten", quantity: 1, unitPriceCents: 10_000 }],
      vatPercent: 7,
    });
    expect((result.data as { note: string }).note).toContain("nicht geprüft");
  });
});

describe("knowledge.write und documents.write", () => {
  it("kennzeichnet agentengeschriebenes Wissen als solches", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { knowledgeDocument } = await import("@/server/db/schema");
    const runId = crypto.randomUUID();

    const result = await callTool(
      "knowledge.write",
      "company-memory",
      {
        title: "Entscheidung zur Rechnungsprüfung",
        content:
          "Rechnungen über 5000 Euro werden ab sofort von zwei Personen geprüft. Beschlossen im Leitungsmeeting.",
      },
      { runId },
    );
    const documentId = (result.data as { documentId: string }).documentId;

    const [doc] = await withOrg(orgId, (tx) =>
      tx
        .select()
        .from(knowledgeDocument)
        .where(eq(knowledgeDocument.id, documentId)),
    );
    expect(doc!.origin).toBe("agent_knowledge");
    expect(doc!.createdByAgentInstanceId).toBe(instances.get("company-memory"));
    expect(doc!.createdByRunId).toBe(runId);
    // Kein Mensch als Urheber — sonst wäre die Herkunft falsch.
    expect(doc!.uploadedByUserId).toBeNull();
  });

  it("stellt den Herkunftsvermerk in den Text selbst", async () => {
    const { searchKnowledge } = await import("@/server/knowledge/service");
    await callTool("knowledge.write", "company-memory", {
      title: "Reisekostenregel",
      content:
        "Bahnfahrten werden in der zweiten Klasse gebucht. Ausnahmen genehmigt die Geschäftsführung.",
    });
    const hits = await searchKnowledge({
      organizationId: orgId,
      query: "Bahnfahrten zweite Klasse",
      requesterRole: null,
      limit: 5,
    });
    expect(hits.length).toBeGreaterThan(0);
    // Herkunft muss in der Suche erkennbar sein, sonst zitiert ein anderer
    // Agent den Text wie ein hochgeladenes Dokument.
    expect(hits.some((h) => h.origin === "agent_knowledge")).toBe(true);
    expect(
      hits.some((h) => h.content.includes("Von einem digitalen Mitarbeiter erzeugt")),
    ).toBe(true);
  });

  it("markiert erzeugte Dokumente als Entwurf und nicht als freigegeben", async () => {
    const result = await callTool("documents.write", "proposal", {
      title: "Angebot Musterfirma",
      content:
        "Angebot über die Einführung eines Dokumentenmanagements mit drei Arbeitspaketen und Zeitplan.",
      documentType: "angebot",
    });
    expect(result.summary).toContain("Entwurf");
    expect((result.data as { approved: boolean }).approved).toBe(false);
    expect((result.data as { origin: string }).origin).toBe("agent_document");
  });

  it("verweigert einen eingeschränkten Eintrag ohne berechtigte Rolle", async () => {
    await expect(
      callTool("knowledge.write", "company-memory", {
        title: "Vertraulicher Vermerk",
        content:
          "Dieser Eintrag hätte einen Zugriffsbereich, aber keine einzige berechtigte Rolle.",
        accessScope: "restricted",
        allowedRoles: [],
      }),
    ).rejects.toThrow(/allowedRoles/);
  });
});

describe("agents.dispatch", () => {
  it("verweigert Delegation an sich selbst", async () => {
    await expect(
      callTool("agents.dispatch", "chief-of-staff", {
        targetSlug: "chief-of-staff",
        capabilityKey: "prioritize",
        goal: "Sich selbst beauftragen",
      }),
    ).rejects.toThrow(/selbst beauftragen/);
  });

  it("verweigert Delegation an einen nicht aktiven Agenten", async () => {
    // "task" steht auf sandbox; der Lauf hier ist kein Sandbox-Lauf.
    await expect(
      callTool("agents.dispatch", "chief-of-staff", {
        targetSlug: "task",
        capabilityKey: "task-extraction",
        goal: "An pausierten Agenten übergeben",
      }),
    ).rejects.toThrow(/nicht aktiv/);
  });

  it("verweigert eine Fähigkeit, die dem Ziel nicht gehört", async () => {
    await expect(
      callTool("agents.dispatch", "chief-of-staff", {
        targetSlug: "company-memory",
        capabilityKey: "invoice-extraction",
        goal: "Fremde Fähigkeit aufrufen",
      }),
    ).rejects.toThrow(/gehört nicht zu/);
  });

  it("verweigert Delegation an einen nicht gebuchten Agenten", async () => {
    await expect(
      callTool("agents.dispatch", "chief-of-staff", {
        targetSlug: "supplier",
        capabilityKey: "supplier-data",
        goal: "Nicht gebuchten Agenten beauftragen",
      }),
    ).rejects.toThrow(/Kein Agent .* gebucht/);
  });

  it("bricht die Kette nach einer Stufe ab — ein delegierter Lauf delegiert nicht weiter", async () => {
    const { adminDb } = await import("@/server/db/client");
    const { agentRun } = await import("@/server/db/schema");

    // Ein Lauf, der selbst durch Delegation entstanden ist.
    const delegatedRunId = crypto.randomUUID();
    await adminDb.insert(agentRun).values({
      id: delegatedRunId,
      organizationId: orgId,
      agentInstanceId: instances.get("chief-of-staff")!,
      definitionSlug: "chief-of-staff",
      capabilityKey: "delegate",
      trigger: { type: "delegation", byInstanceId: "irgendeine" },
      goal: "Bereits delegierter Lauf",
      status: "running",
    });

    await expect(
      callTool(
        "agents.dispatch",
        "chief-of-staff",
        {
          targetSlug: "company-memory",
          capabilityKey: "memory-building",
          goal: "Weiterdelegieren",
        },
        { runId: delegatedRunId },
      ),
    ).rejects.toThrow(/nicht weiterdelegieren/);
  });

  it("übergibt an einen aktiven Agenten und protokolliert die Übergabe", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { auditLog } = await import("@/server/db/schema");

    const result = await callTool("agents.dispatch", "chief-of-staff", {
      targetSlug: "company-memory",
      capabilityKey: "memory-building",
      goal: "Protokoll in die Wissensbasis übernehmen",
      input: {
        text: "Im Meeting wurde beschlossen, die Freigabegrenze auf 5000 Euro zu senken.",
      },
    });
    const data = result.data as { runId: string; status: string };
    expect(["completed", "waiting_approval"]).toContain(data.status);

    const entries = await withOrg(orgId, (tx) =>
      tx.select().from(auditLog).where(eq(auditLog.action, "agent.delegated")),
    );
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.targetId === data.runId)).toBe(true);
  });
});

describe("agents.pause", () => {
  it("verändert im Sandbox-Lauf nichts", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { agentInstance } = await import("@/server/db/schema");

    const result = await callTool(
      "agents.pause",
      "escalation",
      {
        targetSlug: "company-memory",
        reason: "Testlauf soll den Produktivbetrieb nicht anhalten",
      },
      { sandbox: true },
    );
    expect((result.data as { changed: boolean }).changed).toBe(false);

    const [target] = await withOrg(orgId, (tx) =>
      tx
        .select()
        .from(agentInstance)
        .where(eq(agentInstance.id, instances.get("company-memory")!)),
    );
    expect(target!.status).toBe("active");
  });

  it("pausiert einen aktiven Agenten und schreibt den Grund ins Protokoll", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { agentInstance, auditLog } = await import("@/server/db/schema");

    const result = await callTool("agents.pause", "escalation", {
      targetSlug: "monthly-reporting",
      reason: "Wiederholt fehlerhafte Berichte erzeugt",
    });
    expect((result.data as { changed: boolean }).changed).toBe(true);

    const [target] = await withOrg(orgId, (tx) =>
      tx
        .select()
        .from(agentInstance)
        .where(eq(agentInstance.id, instances.get("monthly-reporting")!)),
    );
    expect(target!.status).toBe("paused");

    const entries = await withOrg(orgId, (tx) =>
      tx.select().from(auditLog).where(eq(auditLog.action, "agent.paused")),
    );
    expect(entries.some((e) => e.summary.includes("fehlerhafte Berichte"))).toBe(
      true,
    );
  });

  it("ist idempotent — erneutes Pausieren ändert nichts", async () => {
    const result = await callTool("agents.pause", "escalation", {
      targetSlug: "monthly-reporting",
      reason: "Erneuter Versuch mit demselben Ziel",
    });
    expect((result.data as { changed: boolean }).changed).toBe(false);
    expect(result.summary).toContain("bereits pausiert");
  });

  it("verlangt eine belastbare Begründung", async () => {
    await expect(
      callTool("agents.pause", "escalation", {
        targetSlug: "company-memory",
        reason: "kurz",
      }),
    ).rejects.toThrow();
  });
});

describe("reports.generate und approvals.read", () => {
  it("kennzeichnet die Zeitersparnis als Schätzung", async () => {
    const result = await callTool("reports.generate", "monthly-reporting", {
      periodDays: 30,
    });
    const d = result.data as {
      estimatedMinutesSavedIsEstimate: boolean;
      costsAreZeroBecauseScripted: boolean;
      stats: { totalRuns: number };
    };
    expect(d.estimatedMinutesSavedIsEstimate).toBe(true);
    // Ohne echten KI-Anbieter müssen die Kosten als deshalb-null erkennbar sein.
    expect(typeof d.costsAreZeroBecauseScripted).toBe("boolean");
    expect(d.stats.totalRuns).toBeGreaterThanOrEqual(0);
  });

  it("gibt Freigaben ohne ihre Nutzlast heraus", async () => {
    const result = await callTool("approvals.read", "chief-of-staff", {
      status: ["pending"],
      limit: 10,
    });
    const d = result.data as {
      items: Record<string, unknown>[];
      byRisk: Record<string, number>;
    };
    expect(d.byRisk).toBeDefined();
    // Die Nutzlast kann fremde Inhalte enthalten — sie darf nicht mitreisen.
    for (const item of d.items) {
      expect(item.payload).toBeUndefined();
      expect(item.editedPayload).toBeUndefined();
      expect(item.reasoning).toBeUndefined();
    }
  });
});
