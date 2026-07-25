import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { withOrg } from "@/server/db/client";
import { agentInstance, agentRun, approvalRequest } from "@/server/db/schema";
import { getAgentDefinition } from "@/server/agents/catalog";
import { ingestDocument } from "@/server/knowledge/service";
import { loadReport } from "@/server/reports/service";
import { recordAudit } from "@/server/audit";
import { markImplemented, registerTool } from "./tools";

/**
 * Plattforminterne Werkzeuge.
 *
 * Anders als die Connector-Werkzeuge (tools-connectors.ts) brauchen diese
 * keinerlei externe Zugangsdaten — sie arbeiten ausschließlich auf den eigenen
 * Tabellen. Sie waren zuvor Platzhalter, obwohl nichts sie blockierte; das war
 * eine Lücke in der Umsetzung, kein Integrationsproblem.
 *
 * Zwei Grundsätze, die hier besonders zählen:
 *  - Schreibende Werkzeuge kennzeichnen ihre Herkunft. Ein von einem Agenten
 *    geschriebener Wissenseintrag darf später nicht wie ein hochgeladener
 *    Vertrag aussehen.
 *  - Werkzeuge, die andere Agenten steuern (`agents.dispatch`, `agents.pause`),
 *    begrenzen sich selbst: keine Rekursion, keine Rechteweitergabe.
 */

/* ------------------------------------------------------------------------- */
/* reports.generate — Kennzahlen aus echten Laufdaten                        */
/* ------------------------------------------------------------------------- */

registerTool({
  key: "reports.generate",
  name: "Bericht aus Laufdaten erzeugen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    periodDays: z.number().int().min(1).max(365).default(30),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as { periodDays: number };
    const report = await loadReport(ctx.organizationId, input.periodDays);

    // Bewusst reduziert: der Agent braucht Kennzahlen, keine Rohdatensätze.
    return {
      summary:
        `Bericht über ${input.periodDays} Tage: ${report.stats.totalRuns} Läufe, ` +
        `${report.stats.completedRuns} abgeschlossen, ${report.stats.failedRuns} fehlgeschlagen ` +
        `(Erfolgsquote ${report.stats.successRate}%).`,
      data: {
        periodDays: report.periodDays,
        since: report.since,
        stats: report.stats,
        approvals: report.approvals,
        tasks: report.tasks,
        topAgents: report.agents
          .slice()
          .sort((a, b) => b.runs - a.runs)
          .slice(0, 10)
          .map((a) => ({
            displayName: a.displayName,
            roleTitle: a.roleTitle,
            department: a.department,
            runs: a.runs,
            successRate: a.successRate,
            lastRunAt: a.lastRunAt,
          })),
        dailyRuns: report.dailyRuns,
        // Diese beiden Felder müssen mitreisen, sonst kann der Agent die
        // Zahlen nicht korrekt einordnen und würde sie als Messung darstellen.
        estimatedMinutesSaved: report.estimatedMinutesSaved,
        estimatedMinutesSavedIsEstimate: true,
        costsAreZeroBecauseScripted: report.costsAreZeroBecauseScripted,
      },
    };
  },
});

/* ------------------------------------------------------------------------- */
/* knowledge.write — in die eigene Wissensbasis schreiben                    */
/* ------------------------------------------------------------------------- */

const knowledgeWriteSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(30).max(50_000),
  accessScope: z.enum(["organization", "restricted"]).default("organization"),
  allowedRoles: z.array(z.string()).max(10).default([]),
});

registerTool({
  key: "knowledge.write",
  name: "Wissenseintrag anlegen",
  riskLevel: "low",
  idempotent: false,
  inputSchema: knowledgeWriteSchema,
  async execute(ctx, rawInput) {
    const input = knowledgeWriteSchema.parse(rawInput);
    if (input.accessScope === "restricted" && input.allowedRoles.length === 0) {
      throw new Error(
        'accessScope "restricted" ohne allowedRoles würde den Eintrag für niemanden lesbar machen.',
      );
    }

    const instance = await loadInstance(ctx.organizationId, ctx.instanceId);
    const label = agentLabel(instance);

    const result = await ingestDocument({
      organizationId: ctx.organizationId,
      userId: null,
      userLabel: label,
      filename: `${slugify(input.title)}.md`,
      mimeType: "text/markdown",
      buffer: Buffer.from(withProvenanceNote(input.content, label), "utf8"),
      title: input.title,
      accessScope: input.accessScope,
      allowedRoles: input.allowedRoles,
      origin: "agent_knowledge",
      agentInstanceId: ctx.instanceId,
      runId: ctx.runId,
    });

    return {
      summary: `Wissenseintrag "${input.title}" angelegt (${result.chunkCount} Abschnitte, als agentengeschrieben gekennzeichnet).`,
      data: {
        documentId: result.documentId,
        chunkCount: result.chunkCount,
        origin: "agent_knowledge",
      },
    };
  },
});

/* ------------------------------------------------------------------------- */
/* documents.write — Dokumententwurf erzeugen                                */
/* ------------------------------------------------------------------------- */

const documentsWriteSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(30).max(100_000),
  /** Freie Typangabe zur Einordnung, z. B. "angebot", "protokoll". */
  documentType: z.string().max(60).default("dokument"),
  accessScope: z.enum(["organization", "restricted"]).default("organization"),
  allowedRoles: z.array(z.string()).max(10).default([]),
});

registerTool({
  key: "documents.write",
  name: "Dokument erzeugen",
  riskLevel: "low",
  idempotent: false,
  inputSchema: documentsWriteSchema,
  async execute(ctx, rawInput) {
    const input = documentsWriteSchema.parse(rawInput);
    if (input.accessScope === "restricted" && input.allowedRoles.length === 0) {
      throw new Error(
        'accessScope "restricted" ohne allowedRoles würde das Dokument für niemanden lesbar machen.',
      );
    }

    const instance = await loadInstance(ctx.organizationId, ctx.instanceId);
    const label = agentLabel(instance);

    const result = await ingestDocument({
      organizationId: ctx.organizationId,
      userId: null,
      userLabel: label,
      filename: `${slugify(input.title)}.md`,
      mimeType: "text/markdown",
      buffer: Buffer.from(withProvenanceNote(input.content, label), "utf8"),
      title: `[Entwurf] ${input.title}`.slice(0, 200),
      accessScope: input.accessScope,
      allowedRoles: input.allowedRoles,
      origin: "agent_document",
      agentInstanceId: ctx.instanceId,
      runId: ctx.runId,
    });

    return {
      // "Entwurf" steht bewusst im Titel und in der Zusammenfassung: das
      // Dokument ist erzeugt, nicht geprüft und nicht freigegeben.
      summary: `Dokumententwurf "${input.title}" (${input.documentType}) erzeugt — als Entwurf gekennzeichnet, nicht freigegeben.`,
      data: {
        documentId: result.documentId,
        chunkCount: result.chunkCount,
        documentType: input.documentType,
        origin: "agent_document",
        approved: false,
      },
    };
  },
});

/* ------------------------------------------------------------------------- */
/* approvals.read — offene Freigaben einsehen                                */
/* ------------------------------------------------------------------------- */

registerTool({
  key: "approvals.read",
  name: "Offene Freigaben lesen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    status: z
      .array(z.enum(["pending", "approved", "rejected", "expired", "cancelled"]))
      .default(["pending"]),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      status: string[];
      limit: number;
    };
    const rows = await withOrg(ctx.organizationId, (tx) =>
      tx
        .select({
          id: approvalRequest.id,
          agentInstanceId: approvalRequest.agentInstanceId,
          capabilityKey: approvalRequest.capabilityKey,
          actionType: approvalRequest.actionType,
          title: approvalRequest.title,
          riskLevel: approvalRequest.riskLevel,
          status: approvalRequest.status,
          expiresAt: approvalRequest.expiresAt,
          createdAt: approvalRequest.createdAt,
        })
        .from(approvalRequest)
        .where(inArray(approvalRequest.status, input.status))
        .orderBy(desc(approvalRequest.createdAt))
        .limit(input.limit),
    );

    // Die Nutzlast bleibt bewusst außen vor: sie kann fremde Inhalte enthalten,
    // die ein lesender Agent als Anweisung missverstehen könnte.
    const byRisk = { low: 0, medium: 0, high: 0 } as Record<string, number>;
    for (const r of rows) byRisk[r.riskLevel] = (byRisk[r.riskLevel] ?? 0) + 1;
    const now = Date.now();

    return {
      summary: `${rows.length} Freigabe(n) gelesen (${byRisk.low} risikoarm, ${byRisk.medium} mittel, ${byRisk.high} hoch).`,
      data: {
        byRisk,
        bulkEligible: rows.filter((r) => r.riskLevel === "low" && r.status === "pending")
          .length,
        items: rows.map((r) => ({
          id: r.id,
          capabilityKey: r.capabilityKey,
          actionType: r.actionType,
          title: r.title,
          riskLevel: r.riskLevel,
          status: r.status,
          ageMinutes: Math.round((now - r.createdAt.getTime()) / 60_000),
          expiresAt: r.expiresAt?.toISOString() ?? null,
        })),
      },
    };
  },
});

/* ------------------------------------------------------------------------- */
/* agents.dispatch — Arbeit an einen anderen Agenten übergeben               */
/* ------------------------------------------------------------------------- */

registerTool({
  key: "agents.dispatch",
  name: "Aufgabe an Agenten übergeben",
  riskLevel: "medium",
  idempotent: false,
  inputSchema: z.object({
    targetSlug: z.string().min(2).max(80),
    capabilityKey: z.string().min(2).max(80),
    goal: z.string().min(5).max(300),
    input: z.record(z.string(), z.unknown()).default({}),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      targetSlug: string;
      capabilityKey: string;
      goal: string;
      input: Record<string, unknown>;
    };

    // (1) Keine Rekursion. Ein delegierter Lauf darf nicht weiterdelegieren —
    // sonst könnten sich Agenten gegenseitig endlos beauftragen und die
    // Limits je Lauf wären wirkungslos, weil jeder Lauf sein eigenes Budget hat.
    const [parentRun] = await withOrg(ctx.organizationId, (tx) =>
      tx
        .select({ trigger: agentRun.trigger })
        .from(agentRun)
        .where(eq(agentRun.id, ctx.runId)),
    );
    if (parentRun && (parentRun.trigger as { type?: string })?.type === "delegation") {
      throw new Error(
        "Ein delegierter Lauf darf nicht weiterdelegieren. Die Kette endet nach einer Stufe.",
      );
    }

    // (2) Nicht an sich selbst.
    const self = await loadInstance(ctx.organizationId, ctx.instanceId);
    if (self.definitionSlug === input.targetSlug) {
      throw new Error("Ein Agent kann sich nicht selbst beauftragen.");
    }

    // (3) Ziel muss existieren und betriebsbereit sein.
    const [target] = await withOrg(ctx.organizationId, (tx) =>
      tx
        .select()
        .from(agentInstance)
        .where(eq(agentInstance.definitionSlug, input.targetSlug)),
    );
    if (!target) {
      throw new Error(
        `Kein Agent "${input.targetSlug}" in dieser Organisation gebucht.`,
      );
    }
    const requiredStatus = ctx.sandbox ? ["active", "sandbox"] : ["active"];
    if (!requiredStatus.includes(target.status)) {
      throw new Error(
        `Agent "${input.targetSlug}" ist nicht aktiv (Status: ${target.status}) und wird nicht beauftragt.`,
      );
    }

    // (4) Die Fähigkeit muss zum Ziel gehören und dort nicht abgeschaltet sein.
    const targetDef = getAgentDefinition(input.targetSlug);
    if (!targetDef) {
      throw new Error(`Agentendefinition "${input.targetSlug}" nicht im Katalog.`);
    }
    const capability = targetDef.capabilities.find(
      (c) => c.key === input.capabilityKey,
    );
    if (!capability) {
      throw new Error(
        `Fähigkeit "${input.capabilityKey}" gehört nicht zu "${input.targetSlug}".`,
      );
    }
    if (target.disabledCapabilities.includes(input.capabilityKey)) {
      throw new Error(
        `Fähigkeit "${input.capabilityKey}" ist bei "${input.targetSlug}" abgeschaltet.`,
      );
    }

    // (5) Der beauftragte Lauf gilt mit seinen eigenen Rechten und seiner
    // eigenen Automatisierungsstufe. Delegation gibt nichts weiter.
    const { startRun } = await import("./engine");
    const outcome = await startRun({
      organizationId: ctx.organizationId,
      instanceId: target.id,
      capabilityKey: input.capabilityKey,
      goal: input.goal,
      input: input.input,
      trigger: {
        type: "delegation",
        byInstanceId: ctx.instanceId,
        byRunId: ctx.runId,
      },
      sandbox: ctx.sandbox,
      requestedByUserId: ctx.requestedByUserId,
    });

    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "agent",
      actorId: ctx.instanceId,
      actorLabel: agentLabel(self),
      action: "agent.delegated",
      targetType: "agent_run",
      targetId: outcome.runId,
      summary: `${agentLabel(self)} hat "${input.capabilityKey}" an ${target.displayName} übergeben (Ergebnis: ${outcome.status}).`,
      metadata: { targetSlug: input.targetSlug, parentRunId: ctx.runId },
    });

    return {
      summary: `An ${target.displayName} übergeben: ${input.capabilityKey} → ${outcome.status}.`,
      data: {
        runId: outcome.runId,
        status: outcome.status,
        targetSlug: input.targetSlug,
        targetDisplayName: target.displayName,
        resultSummary: outcome.summary,
      },
    };
  },
});

/* ------------------------------------------------------------------------- */
/* agents.pause — einen Agenten anhalten                                     */
/* ------------------------------------------------------------------------- */

registerTool({
  key: "agents.pause",
  name: "Agenten pausieren",
  // Mittleres Risiko: Das Anhalten eines Agenten unterbricht Arbeitsabläufe.
  // Über die Engine bedeutet das eine menschliche Freigabe, bevor es wirkt.
  riskLevel: "medium",
  idempotent: true,
  inputSchema: z.object({
    targetSlug: z.string().min(2).max(80),
    reason: z.string().min(10).max(500),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      targetSlug: string;
      reason: string;
    };

    const self = await loadInstance(ctx.organizationId, ctx.instanceId);
    const [target] = await withOrg(ctx.organizationId, (tx) =>
      tx
        .select()
        .from(agentInstance)
        .where(eq(agentInstance.definitionSlug, input.targetSlug)),
    );
    if (!target) {
      throw new Error(
        `Kein Agent "${input.targetSlug}" in dieser Organisation gebucht.`,
      );
    }
    if (target.status === "paused") {
      return {
        summary: `${target.displayName} ist bereits pausiert — keine Änderung.`,
        data: { targetSlug: input.targetSlug, status: "paused", changed: false },
      };
    }
    if (target.status !== "active") {
      throw new Error(
        `Agent "${input.targetSlug}" ist nicht aktiv (Status: ${target.status}) und wird nicht pausiert.`,
      );
    }

    // Im Sandbox-Lauf wird nichts verändert — ein Testlauf darf den
    // Produktivbetrieb nicht anhalten.
    if (ctx.sandbox) {
      return {
        summary: `Sandbox: ${target.displayName} würde pausiert (${input.reason}). Es wurde nichts verändert.`,
        data: {
          targetSlug: input.targetSlug,
          status: target.status,
          changed: false,
          sandbox: true,
        },
      };
    }

    await withOrg(ctx.organizationId, (tx) =>
      tx
        .update(agentInstance)
        .set({ status: "paused" })
        .where(
          and(
            eq(agentInstance.id, target.id),
            // Erneute Statusprüfung im UPDATE: zwischen Lesen und Schreiben
            // kann ein Mensch den Agenten deaktiviert haben.
            eq(agentInstance.status, "active"),
          ),
        ),
    );

    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "agent",
      actorId: ctx.instanceId,
      actorLabel: agentLabel(self),
      action: "agent.paused",
      targetType: "agent_instance",
      targetId: target.id,
      summary: `${target.displayName} wurde pausiert. Grund: ${input.reason}`,
      metadata: { byInstanceId: ctx.instanceId, runId: ctx.runId },
    });

    return {
      summary: `${target.displayName} pausiert. Grund: ${input.reason}`,
      data: { targetSlug: input.targetSlug, status: "paused", changed: true },
    };
  },
});

/* ------------------------------------------------------------------------- */
/* pricing.calculate — Positionen serverseitig rechnen                       */
/* ------------------------------------------------------------------------- */

const lineItemSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.number().finite().min(0).max(1_000_000),
  unitPriceCents: z.number().int().min(0).max(100_000_000),
  /** Rabatt in Prozent auf diese Position. */
  discountPercent: z.number().finite().min(0).max(100).default(0),
});

const pricingSchema = z.object({
  items: z.array(lineItemSchema).min(1).max(100),
  /** Rabatt in Prozent auf die Summe aller Positionen. */
  totalDiscountPercent: z.number().finite().min(0).max(100).default(0),
  /** Umsatzsteuersatz in Prozent. Deutschland: 19 oder 7. */
  vatPercent: z.number().finite().min(0).max(100).default(19),
  currency: z.enum(["EUR", "CHF"]).default("EUR"),
});

registerTool({
  key: "pricing.calculate",
  name: "Preise berechnen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: pricingSchema,
  async execute(_ctx, rawInput) {
    // Bewusst reine Arithmetik ohne KI: Ein Modell darf Beträge nicht rechnen.
    // Fehlt eine Zahl oder ist sie kein Zahlwert, schlägt die Validierung fehl,
    // statt einen plausibel klingenden Betrag zu erzeugen.
    const input = pricingSchema.parse(rawInput);

    const items = input.items.map((item) => {
      const gross = Math.round(item.quantity * item.unitPriceCents);
      const discount = Math.round((gross * item.discountPercent) / 100);
      return {
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        discountPercent: item.discountPercent,
        lineTotalCents: gross - discount,
      };
    });

    const subtotal = items.reduce((s, i) => s + i.lineTotalCents, 0);
    const totalDiscount = Math.round((subtotal * input.totalDiscountPercent) / 100);
    const net = subtotal - totalDiscount;
    const vat = Math.round((net * input.vatPercent) / 100);

    return {
      summary:
        `${items.length} Position(en): netto ${formatCents(net, input.currency)}, ` +
        `USt ${input.vatPercent}% = ${formatCents(vat, input.currency)}, ` +
        `brutto ${formatCents(net + vat, input.currency)}.`,
      data: {
        items,
        subtotalCents: subtotal,
        totalDiscountPercent: input.totalDiscountPercent,
        totalDiscountCents: totalDiscount,
        netCents: net,
        vatPercent: input.vatPercent,
        vatCents: vat,
        grossCents: net + vat,
        currency: input.currency,
        // Der Hinweis reist mit, damit ein Entwurf die Steuerfrage nicht als
        // geklärt darstellt — das ist keine steuerliche Beratung.
        note: `Umsatzsteuersatz ${input.vatPercent}% wurde übernommen, nicht geprüft. Steuerliche Beurteilung liegt beim Menschen.`,
      },
    };
  },
});

/* ------------------------------------------------------------------------- */
/* Hilfsfunktionen                                                            */
/* ------------------------------------------------------------------------- */

async function loadInstance(
  organizationId: string,
  instanceId: string,
): Promise<typeof agentInstance.$inferSelect> {
  const [row] = await withOrg(organizationId, (tx) =>
    tx.select().from(agentInstance).where(eq(agentInstance.id, instanceId)),
  );
  if (!row) throw new Error("Agenteninstanz nicht gefunden.");
  return row;
}

function agentLabel(instance: typeof agentInstance.$inferSelect): string {
  const def = getAgentDefinition(instance.definitionSlug);
  return def
    ? `${instance.displayName} (${def.roleTitle})`
    : instance.displayName;
}

/**
 * Setzt einen sichtbaren Herkunftsvermerk in den Text selbst. Die Spalte
 * `origin` allein genügt nicht: Wird ein Abschnitt später als Beleg zitiert
 * oder exportiert, reist der Vermerk mit dem Inhalt mit.
 */
function withProvenanceNote(content: string, label: string): string {
  return `> Von einem digitalen Mitarbeiter erzeugt (${label}). Inhalt nicht menschlich geprüft.\n\n${content}`;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" })[c]!)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "eintrag"
  );
}

function formatCents(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

// Alle sieben sind echt implementiert und arbeiten auf eigenen Tabellen.
markImplemented([
  "reports.generate",
  "knowledge.write",
  "documents.write",
  "approvals.read",
  "agents.dispatch",
  "agents.pause",
  "pricing.calculate",
]);
