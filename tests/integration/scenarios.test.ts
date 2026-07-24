import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

/**
 * Die fünf Pflicht-Szenarien aus Spec §27, end-to-end durch die echte
 * Server-Logik: Connectoren → Runtime → Freigabe → Ausführung → Audit-Log.
 * KI-Verarbeitung läuft deterministisch über den ScriptedProvider.
 */

const orgId = `sc-org-${Date.now()}`;
const otherOrgId = `sc-other-${Date.now()}`;
const userId = `sc-user-${Date.now()}`;

async function hireAgent(slug: string, overrides: Record<string, unknown> = {}) {
  const { adminDb } = await import("@/server/db/client");
  const { agentInstance } = await import("@/server/db/schema");
  const { getAgentDefinition } = await import("@/server/agents/catalog");
  const def = getAgentDefinition(slug)!;
  const [row] = await adminDb
    .insert(agentInstance)
    .values({
      organizationId: orgId,
      definitionSlug: slug,
      displayName: def.personaName,
      status: "active",
      allowedTools: [...new Set(def.capabilities.flatMap((c) => c.requiredTools))],
      responsibleUserId: userId,
      ...overrides,
    })
    .onConflictDoUpdate({
      target: [agentInstance.organizationId, agentInstance.definitionSlug],
      set: { status: "active", ...overrides },
    })
    .returning();
  return row!;
}

async function approveAll(runId: string) {
  const { withOrg } = await import("@/server/db/client");
  const { approvalRequest } = await import("@/server/db/schema");
  const { decideApproval } = await import("@/server/agents/runtime/approvals");
  const approvals = await withOrg(orgId, (tx) =>
    tx
      .select()
      .from(approvalRequest)
      .where(
        and(
          eq(approvalRequest.runId, runId),
          eq(approvalRequest.status, "pending"),
        ),
      ),
  );
  for (const a of approvals) {
    const result = await decideApproval({
      organizationId: orgId,
      approvalId: a.id,
      userId,
      userLabel: "Szenario-Tester",
      decision: "approve",
    });
    expect(result.ok, result.message).toBe(true);
  }
  return approvals;
}

describe("Spec §27 — Pflicht-Szenarien", () => {
  beforeAll(async () => {
    const { adminDb } = await import("@/server/db/client");
    const { organization, user } = await import("@/server/db/schema");
    await adminDb.insert(organization).values([
      { id: orgId, name: "Szenario Org", slug: orgId, createdAt: new Date() },
      {
        id: otherOrgId,
        name: "Fremde Org",
        slug: otherOrgId,
        createdAt: new Date(),
      },
    ]);
    await adminDb.insert(user).values({
      id: userId,
      name: "Szenario Tester",
      email: `${userId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    const { adminDb } = await import("@/server/db/client");
    const { organization, user } = await import("@/server/db/schema");
    await adminDb
      .delete(organization)
      .where(eq(organization.id, orgId));
    await adminDb.delete(organization).where(eq(organization.id, otherOrgId));
    await adminDb.delete(user).where(eq(user.id, userId));
  });

  /* ---------------------------------------------------------------------- */
  it("Szenario 1: E-Mail → Triage → Aufgabe nach Freigabe → Audit-Log", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { emailMessage, task, auditLog } = await import("@/server/db/schema");
    const { startRun } = await import("@/server/agents/runtime/engine");

    // 1. E-Mail trifft über den Demo-Connector ein
    const [mail] = await withOrg(orgId, (tx) =>
      tx
        .insert(emailMessage)
        .values({
          organizationId: orgId,
          direction: "inbound",
          status: "received",
          fromAddress: "kunde@beispiel.de",
          toAddress: "team@demo-organisation.de",
          subject: "Rückfrage zum Angebot",
          body: "Guten Tag,\n\nbitte senden Sie uns die aktualisierte Preisliste bis 20.09.2026 und klären Sie die Lieferzeiten.\n\nViele Grüße",
          receivedAt: new Date(),
          demo: true,
        })
        .returning(),
    );
    expect(mail!.triagedAt).toBeNull();

    // 2. Email Triage Agent klassifiziert
    const triageAgent = await hireAgent("email-triage");
    const triageRun = await startRun({
      organizationId: orgId,
      instanceId: triageAgent.id,
      capabilityKey: "classify",
      goal: "Posteingang klassifizieren",
      input: {},
      trigger: { type: "event", source: "demo-email" },
      requestedByUserId: userId,
    });
    expect(["completed", "waiting_approval"]).toContain(triageRun.status);

    const [triaged] = await withOrg(orgId, (tx) =>
      tx.select().from(emailMessage).where(eq(emailMessage.id, mail!.id)),
    );
    expect(triaged!.triagedAt).not.toBeNull();
    expect(triaged!.category).toBeTruthy();
    expect(triaged!.urgency).toBeTruthy();

    // 3. Task Agent extrahiert eine Aufgabe (Stufe 3 → Freigabe)
    const taskAgent = await hireAgent("task");
    const taskRun = await startRun({
      organizationId: orgId,
      instanceId: taskAgent.id,
      capabilityKey: "task-extraction",
      goal: "Aufgaben aus E-Mail extrahieren",
      input: {
        text: `Betreff: ${mail!.subject}\n\n${mail!.body}`,
        sourceType: "email",
        sourceRef: mail!.id,
      },
      trigger: { type: "delegation", from: "email-triage" },
      requestedByUserId: userId,
    });

    // 4. Nutzer erhält eine Freigabe
    expect(taskRun.status).toBe("waiting_approval");
    const tasksBefore = await withOrg(orgId, (tx) => tx.select().from(task));
    expect(tasksBefore).toHaveLength(0);

    // 5. Nach Freigabe wird die Aufgabe erstellt
    const approvals = await approveAll(taskRun.runId);
    expect(approvals.length).toBeGreaterThanOrEqual(1);
    const tasksAfter = await withOrg(orgId, (tx) => tx.select().from(task));
    expect(tasksAfter.length).toBeGreaterThanOrEqual(1);
    expect(tasksAfter[0]!.createdByType).toBe("agent");
    const src = tasksAfter[0]!.source as { type?: string; ref?: string };
    expect(src.type).toBe("email");

    // 6. Der Vorgang erscheint im Audit Log
    const audit = await withOrg(orgId, (tx) => tx.select().from(auditLog));
    const actions = audit.map((a) => a.action);
    expect(actions).toContain("approval.approved");
    expect(actions.some((a) => a.startsWith("agent.run."))).toBe(true);

    await withOrg(orgId, (tx) => tx.delete(task));
  });

  /* ---------------------------------------------------------------------- */
  it("Szenario 2: Kalendertermin → quellenbasiertes Briefing mit Lückenkennzeichnung", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { calendarEvent, task } = await import("@/server/db/schema");
    const { startRun } = await import("@/server/agents/runtime/engine");
    const { ingestDocument } = await import("@/server/knowledge/service");

    // Wissensdokument als Quelle
    await ingestDocument({
      organizationId: orgId,
      userId,
      userLabel: "Szenario Tester",
      filename: "vertrag.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# Servicevertrag\n\nDie Kündigungsfrist beträgt drei Monate zum Jahresende. Die Wartungspauschale beträgt zwölf Prozent des Lizenzwertes und umfasst zwei Schulungstage pro Jahr.",
        "utf-8",
      ),
      title: "Servicevertrag",
    });

    // 1. Kalendertermin wird erkannt
    await withOrg(orgId, (tx) =>
      tx.insert(calendarEvent).values({
        organizationId: orgId,
        title: "Strategiegespräch Wartungspauschale",
        description: null, // bewusst leer → Lücke muss gekennzeichnet werden
        location: "Videokonferenz",
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
        attendees: [],
        demo: true,
      }),
    );

    // 2./3. Agent sammelt erlaubte Daten und erstellt ein Briefing
    const agent = await hireAgent("meeting-preparation", {
      automationOverrides: { "meeting-briefing": 4 },
    });
    const run = await startRun({
      organizationId: orgId,
      instanceId: agent.id,
      capabilityKey: "meeting-briefing",
      goal: "Briefing für anstehenden Termin",
      input: {},
      trigger: { type: "schedule" },
      requestedByUserId: userId,
    });
    expect(run.status).toBe("completed");

    // 4. Das Briefing erscheint als Aufgabe (Dashboard/Tasks)
    const tasks = await withOrg(orgId, (tx) => tx.select().from(task));
    const briefing = tasks.find((t) => t.title.startsWith("Briefing:"));
    expect(briefing).toBeDefined();

    // 5. Fehlende Informationen werden gekennzeichnet
    expect(briefing!.description).toMatch(/Offene Punkte|fehlende Informationen/i);
    expect(briefing!.description).toMatch(/Agenda|Teilnehmerliste/i);

    await withOrg(orgId, (tx) => tx.delete(task));
  });

  /* ---------------------------------------------------------------------- */
  it("Szenario 3: Offenes Angebot → Follow-up-Entwurf → Freigabe → Versand → CRM & Kosten protokolliert", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { deal, emailMessage, agentRun, auditLog } = await import(
      "@/server/db/schema"
    );
    const { startRun } = await import("@/server/agents/runtime/engine");

    // 1. Deal mit versendetem Angebot wird importiert
    const [importedDeal] = await withOrg(orgId, (tx) =>
      tx
        .insert(deal)
        .values({
          organizationId: orgId,
          name: "Wartungsvertrag Beispiel",
          company: "Beispiel GmbH",
          contactEmail: "einkauf@beispiel.de",
          stage: "angebot_versendet",
          valueCents: 1_200_000,
          proposalSentAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
          lastActivityAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
          notes: "Angebot versendet, keine Reaktion.",
          demo: true,
        })
        .returning(),
    );

    // Deal mit Sperrvermerk darf NICHT angesprochen werden
    await withOrg(orgId, (tx) =>
      tx.insert(deal).values({
        organizationId: orgId,
        name: "Gesperrter Deal",
        company: "Südwerk AG",
        contactEmail: "einkauf@suedwerk.de",
        stage: "angebot_versendet",
        valueCents: 5_000_000,
        proposalSentAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        doNotContact: true,
        demo: true,
      }),
    );

    // 2./3. Follow-up Agent erkennt fehlende Antwort und erstellt Entwurf
    const agent = await hireAgent("follow-up");
    const run = await startRun({
      organizationId: orgId,
      instanceId: agent.id,
      capabilityKey: "followup-drafting",
      goal: "Follow-ups für offene Angebote",
      input: { staleAfterDays: 7 },
      trigger: { type: "schedule" },
      requestedByUserId: userId,
    });
    expect(run.status).toBe("waiting_approval");

    // 4. Nutzer genehmigt (mit Bearbeitung des Entwurfs)
    const { approvalRequest } = await import("@/server/db/schema");
    const pending = await withOrg(orgId, (tx) =>
      tx
        .select()
        .from(approvalRequest)
        .where(
          and(
            eq(approvalRequest.runId, run.runId),
            eq(approvalRequest.status, "pending"),
          ),
        ),
    );
    expect(pending.length).toBeGreaterThanOrEqual(1);
    // Sperrvermerk respektiert: kein Entwurf für Südwerk
    const recipients = pending.map(
      (p) => (p.payload as { to?: string }).to ?? "",
    );
    expect(recipients).not.toContain("einkauf@suedwerk.de");
    expect(recipients).toContain("einkauf@beispiel.de");
    // Hochriskante Aktion → Risikostufe high, nie automatisch ausgeführt
    expect(pending[0]!.riskLevel).toBe("high");

    const { decideApproval } = await import("@/server/agents/runtime/approvals");
    const target = pending.find(
      (p) => (p.payload as { to?: string }).to === "einkauf@beispiel.de",
    )!;
    const editedPayload = {
      ...(target.payload as Record<string, unknown>),
      body: "Guten Tag,\n\nvom Menschen bearbeitete Fassung des Follow-ups.\n\nMit freundlichen Grüßen",
    };
    const decision = await decideApproval({
      organizationId: orgId,
      approvalId: target.id,
      userId,
      userLabel: "Szenario Tester",
      decision: "approve",
      editedPayload,
    });
    expect(decision.ok).toBe(true);

    // 5. Nachricht wird über die Integration versendet (Demo-Postfach)
    const outbox = await withOrg(orgId, (tx) =>
      tx
        .select()
        .from(emailMessage)
        .where(
          and(
            eq(emailMessage.direction, "outbound"),
            eq(emailMessage.status, "sent"),
          ),
        ),
    );
    expect(outbox.length).toBeGreaterThanOrEqual(1);
    const sent = outbox.find((m) => m.toAddress === "einkauf@beispiel.de");
    expect(sent).toBeDefined();
    // Die bearbeitete Fassung wurde versendet, nicht das Original
    expect(sent!.body).toMatch(/vom Menschen bearbeitete Fassung/);

    // 6. CRM wird aktualisiert
    const [updatedDeal] = await withOrg(orgId, (tx) =>
      tx.select().from(deal).where(eq(deal.id, importedDeal!.id)),
    );
    expect(updatedDeal!.lastActivityAt!.getTime()).toBeGreaterThan(
      importedDeal!.lastActivityAt!.getTime(),
    );

    // 7. Aktivität und Kosten werden protokolliert
    const [runRow] = await withOrg(orgId, (tx) =>
      tx.select().from(agentRun).where(eq(agentRun.id, run.runId)),
    );
    expect(runRow!.stepCount).toBeGreaterThan(0);
    expect(runRow!.durationMs).not.toBeNull();
    expect(runRow!.costDeciCents).toBeGreaterThanOrEqual(0);
    const audit = await withOrg(orgId, (tx) => tx.select().from(auditLog));
    expect(audit.some((a) => a.action === "approval.approved")).toBe(true);

    await withOrg(orgId, (tx) => tx.delete(deal));
  });

  /* ---------------------------------------------------------------------- */
  it("Szenario 4: Wissensfrage wird quellenbasiert beantwortet; ohne Recht kein Inhalt", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { knowledgeDocument } = await import("@/server/db/schema");
    const { ingestDocument, searchKnowledge } = await import(
      "@/server/knowledge/service"
    );
    const { startRun } = await import("@/server/agents/runtime/engine");
    const { agentRun } = await import("@/server/db/schema");

    // 1./2. Dokument wird hochgeladen und sicher verarbeitet
    const openDoc = await ingestDocument({
      organizationId: orgId,
      userId,
      userLabel: "Szenario Tester",
      filename: "kuendigung.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# Vertragsbedingungen\n\nDie Kündigungsfrist für Kunden beträgt drei Monate zum Ende des Kalenderjahres. Abweichungen bedürfen der Schriftform.",
        "utf-8",
      ),
      title: "Vertragsbedingungen",
    });
    expect(openDoc.chunkCount).toBeGreaterThan(0);

    const [docRow] = await withOrg(orgId, (tx) =>
      tx
        .select()
        .from(knowledgeDocument)
        .where(eq(knowledgeDocument.id, openDoc.documentId)),
    );
    expect(docRow!.status).toBe("ready");

    // Geschütztes Dokument, das nur Owner/Admin sehen dürfen
    await ingestDocument({
      organizationId: orgId,
      userId,
      userLabel: "Szenario Tester",
      filename: "gehalt.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# Vertrauliche Gehaltsbandbreiten\n\nDie Gehaltsbandbreite für Senior-Positionen liegt zwischen 75.000 und 95.000 Euro.",
        "utf-8",
      ),
      title: "Vertrauliche Gehaltsbandbreiten",
      accessScope: "restricted",
      allowedRoles: ["owner", "admin"],
    });

    // 3./4. Company Memory Agent antwortet mit Quellen
    const agent = await hireAgent("company-memory");
    const run = await startRun({
      organizationId: orgId,
      instanceId: agent.id,
      capabilityKey: "qa-with-sources",
      goal: "Wissensfrage beantworten",
      input: {
        question: "Welche Kündigungsfrist gilt für Kunden?",
        requesterRole: "member",
      },
      trigger: { type: "manual" },
      requestedByUserId: userId,
    });
    expect(run.status).toBe("completed");
    const [runRow] = await withOrg(orgId, (tx) =>
      tx.select().from(agentRun).where(eq(agentRun.id, run.runId)),
    );
    const output = runRow!.output as {
      answer: string;
      sources: { title: string }[];
      confidence: string;
    };
    expect(output.sources.length).toBeGreaterThan(0);
    expect(output.answer).toMatch(/drei Monate|Kündigungsfrist/i);
    expect(output.confidence).not.toBe("nicht_belegt");

    // 5. Nutzer ohne Zugriffsrecht erhält keinen Inhalt aus dem geschützten Dokument
    const memberHits = await searchKnowledge({
      organizationId: orgId,
      query: "Gehaltsbandbreite Senior-Positionen",
      requesterRole: "member",
    });
    expect(
      memberHits.some((h) => h.content.includes("95.000")),
    ).toBe(false);

    const ownerHits = await searchKnowledge({
      organizationId: orgId,
      query: "Gehaltsbandbreite Senior-Positionen",
      requesterRole: "owner",
    });
    expect(ownerHits.some((h) => h.content.includes("95.000"))).toBe(true);

    // Mandantentrennung: fremde Organisation sieht nichts
    const foreignHits = await searchKnowledge({
      organizationId: otherOrgId,
      query: "Kündigungsfrist",
      requesterRole: "owner",
    });
    expect(foreignHits).toHaveLength(0);
  });

  /* ---------------------------------------------------------------------- */
  it("Szenario 5: Rechnung → Extraktion → fehlendes Pflichtfeld → Prüfaufgabe, keine Zahlung/Buchung", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { task, agentRun } = await import("@/server/db/schema");
    const { startRun } = await import("@/server/agents/runtime/engine");

    const agent = await hireAgent("invoice-intake");

    // 1./2./3. Rechnung ohne Rechnungsnummer → Pflichtfeld fehlt
    const run = await startRun({
      organizationId: orgId,
      instanceId: agent.id,
      capabilityKey: "invoice-extraction",
      goal: "Rechnung verarbeiten",
      input: {
        text: "CloudParts GmbH\nRechnungsdatum: 01.09.2026\nGesamtbetrag: 2.380,00 EUR\nIBAN: DE89370400440532013000\nZahlbar bis 30.09.2026",
      },
      trigger: { type: "event", source: "upload" },
      requestedByUserId: userId,
    });

    const [runRow] = await withOrg(orgId, (tx) =>
      tx.select().from(agentRun).where(eq(agentRun.id, run.runId)),
    );
    const output = runRow!.output as {
      extraction: { missingFields: string[]; totalAmountCents: number | null };
      needsReview: boolean;
    };
    expect(output.extraction.missingFields).toContain("Rechnungsnummer");
    expect(output.extraction.totalAmountCents).toBe(238_000);
    expect(output.needsReview).toBe(true);

    // 4. Prüfaufgabe wird erstellt (nach Freigabe, da Stufe 3)
    expect(run.status).toBe("waiting_approval");
    await approveAll(run.runId);
    const tasks = await withOrg(orgId, (tx) => tx.select().from(task));
    const reviewTask = tasks.find((t) => t.title.startsWith("Rechnung prüfen:"));
    expect(reviewTask).toBeDefined();
    expect(reviewTask!.priority).toBe("high");
    expect(reviewTask!.description).toMatch(/Fehlende Pflichtfelder/);

    // 5. Es erfolgt keine automatische Zahlung oder Buchung
    expect(reviewTask!.description).toMatch(
      /keine Zahlung ausgelöst und keine Buchung/i,
    );
    expect(run.summary).toMatch(/Keine Zahlung, keine Buchung/);

    await withOrg(orgId, (tx) => tx.delete(task));
  });
});
