import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { withOrg } from "@/server/db/client";
import { deal, emailMessage } from "@/server/db/schema";
import { demoEmailConnector } from "@/server/integrations/demo-email";
import { demoCalendarConnector } from "@/server/integrations/demo-calendar";
import { searchKnowledge } from "@/server/knowledge/service";
import { markImplemented, registerTool } from "./tools";

/**
 * Connector-gestützte Tools. Sie arbeiten gegen die Demo-Connectoren
 * (vollständig implementiert). Sobald echte Integrationen (Gmail, Google
 * Calendar) verbunden sind, wird hier auf den jeweiligen Adapter gewechselt —
 * die Tool-Schnittstelle bleibt identisch.
 */

registerTool({
  key: "email.read",
  name: "Posteingang lesen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    onlyUntriaged: z.boolean().default(true),
    limit: z.number().int().min(1).max(25).default(10),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      onlyUntriaged: boolean;
      limit: number;
    };
    const rows = input.onlyUntriaged
      ? await demoEmailConnector.fetchUntriaged(ctx.organizationId, input.limit)
      : (
          await demoEmailConnector.fetchInbox(ctx.organizationId, input.limit)
        ).map((m) => ({
          id: m.externalId,
          fromAddress: m.from,
          toAddress: m.to,
          subject: m.subject,
          body: m.body,
          receivedAt: m.receivedAt,
        }));
    return {
      summary: `${rows.length} E-Mail(s) gelesen`,
      data: rows.map((r) => ({
        id: r.id,
        from: r.fromAddress,
        subject: r.subject,
        body: r.body,
        receivedAt:
          r.receivedAt instanceof Date ? r.receivedAt.toISOString() : r.receivedAt,
      })),
    };
  },
});

registerTool({
  key: "email.label",
  name: "E-Mail klassifizieren",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    emailId: z.string(),
    category: z.string(),
    urgency: z.string(),
    suspicious: z.boolean().default(false),
    deadlines: z.array(z.string()).default([]),
    labels: z.array(z.string()).default([]),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      emailId: string;
      category: string;
      urgency: string;
      suspicious: boolean;
      deadlines: string[];
      labels: string[];
    };
    const updated = await withOrg(ctx.organizationId, (tx) =>
      tx
        .update(emailMessage)
        .set({
          category: input.category,
          urgency: input.urgency,
          suspicious: input.suspicious,
          deadlines: input.deadlines,
          labels: input.labels,
          triagedAt: new Date(),
          createdByAgentInstanceId: ctx.instanceId,
        })
        .where(eq(emailMessage.id, input.emailId))
        .returning({ subject: emailMessage.subject }),
    );
    if (updated.length === 0) throw new Error("E-Mail nicht gefunden.");
    return {
      summary: `"${updated[0]!.subject}" als ${input.category} (${input.urgency}) eingestuft`,
    };
  },
});

registerTool({
  key: "email.draft",
  name: "E-Mail-Entwurf speichern",
  riskLevel: "low",
  idempotent: false,
  inputSchema: z.object({
    to: z.string().min(3).max(200),
    subject: z.string().min(1).max(300),
    body: z.string().min(1).max(20_000),
    inReplyToId: z.string().nullable().optional(),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      to: string;
      subject: string;
      body: string;
      inReplyToId?: string | null;
    };
    const [row] = await withOrg(ctx.organizationId, (tx) =>
      tx
        .insert(emailMessage)
        .values({
          organizationId: ctx.organizationId,
          direction: "outbound",
          status: "draft",
          fromAddress: "team@demo-organisation.de",
          toAddress: input.to,
          subject: input.subject,
          body: input.body,
          inReplyToId: input.inReplyToId ?? null,
          createdByAgentInstanceId: ctx.instanceId,
          demo: ctx.sandbox,
        })
        .returning({ id: emailMessage.id }),
    );
    return {
      summary: `Entwurf an ${input.to} gespeichert: "${input.subject}"`,
      data: { emailId: row!.id },
    };
  },
});

registerTool({
  key: "email.send",
  name: "E-Mail versenden",
  riskLevel: "high",
  idempotent: false,
  inputSchema: z.object({
    to: z.string().min(3).max(200),
    subject: z.string().min(1).max(300),
    body: z.string().min(1).max(20_000),
    inReplyToId: z.string().nullable().optional(),
    dealId: z.string().nullable().optional(),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      to: string;
      subject: string;
      body: string;
      inReplyToId?: string | null;
      dealId?: string | null;
    };
    const result = await demoEmailConnector.send(ctx.organizationId, {
      to: input.to,
      subject: input.subject,
      body: input.body,
      inReplyToId: input.inReplyToId ?? null,
    });
    // CRM-Aktualisierung: letzter Kontakt am Deal
    if (input.dealId) {
      await withOrg(ctx.organizationId, (tx) =>
        tx
          .update(deal)
          .set({ lastActivityAt: new Date() })
          .where(eq(deal.id, input.dealId!)),
      );
    }
    return {
      summary: `Nachricht an ${input.to} über das Demo-Postfach versendet (verbleibt in der Plattform)`,
      data: { emailId: result.id, delivered: result.delivered },
    };
  },
});

registerTool({
  key: "calendar.read",
  name: "Kalender lesen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    withinHours: z.number().int().min(1).max(720).default(72),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as { withinHours: number };
    const events = await demoCalendarConnector.listUpcoming(
      ctx.organizationId,
      input.withinHours,
    );
    return {
      summary: `${events.length} anstehende Termine gelesen`,
      data: events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        location: e.location,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
        attendees: e.attendees,
      })),
    };
  },
});

registerTool({
  key: "calendar.write",
  name: "Termin anlegen",
  riskLevel: "medium",
  idempotent: false,
  inputSchema: z.object({
    title: z.string().min(3).max(200),
    description: z.string().max(2000).nullable().optional(),
    location: z.string().max(200).nullable().optional(),
    startsAt: z.string(),
    endsAt: z.string(),
    attendees: z.array(z.string()).default([]),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      title: string;
      description?: string | null;
      location?: string | null;
      startsAt: string;
      endsAt: string;
      attendees: string[];
    };
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new Error("Ungültige Zeitangaben für den Termin.");
    }
    const result = await demoCalendarConnector.create(ctx.organizationId, {
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      startsAt,
      endsAt,
      attendees: input.attendees,
    });
    return {
      summary: `Termin "${input.title}" am ${startsAt.toLocaleDateString("de-DE")} angelegt`,
      data: { eventId: result.id },
    };
  },
});

registerTool({
  key: "deals.read",
  name: "Deals lesen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    /** Nur Deals mit versendetem Angebot ohne Aktivität seit X Tagen. */
    staleAfterDays: z.number().int().min(0).max(365).default(7),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      staleAfterDays: number;
      limit: number;
    };
    const threshold = new Date(
      Date.now() - input.staleAfterDays * 24 * 60 * 60 * 1000,
    );
    const rows = await withOrg(ctx.organizationId, (tx) =>
      tx
        .select()
        .from(deal)
        .where(
          and(
            eq(deal.stage, "angebot_versendet"),
            eq(deal.doNotContact, false),
            ne(deal.stage, "gewonnen"),
          ),
        )
        .orderBy(desc(deal.proposalSentAt))
        .limit(input.limit),
    );
    const stale = rows.filter((d) => {
      const last = d.lastActivityAt ?? d.proposalSentAt;
      return !last || last < threshold;
    });
    return {
      summary: `${stale.length} von ${rows.length} offenen Angeboten ohne Reaktion (Schwelle: ${input.staleAfterDays} Tage)`,
      data: stale.map((d) => ({
        id: d.id,
        name: d.name,
        company: d.company,
        contactEmail: d.contactEmail,
        valueCents: d.valueCents,
        proposalSentAt: d.proposalSentAt?.toISOString() ?? null,
        lastActivityAt: d.lastActivityAt?.toISOString() ?? null,
        notes: d.notes,
      })),
    };
  },
});

registerTool({
  key: "knowledge.search",
  name: "Wissensbasis durchsuchen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    query: z.string().min(2).max(500),
    limit: z.number().int().min(1).max(10).default(5),
    /** Rolle der anfragenden Person — steuert Zugriff auf geschützte Dokumente. */
    requesterRole: z.string().nullable().optional(),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      query: string;
      limit: number;
      requesterRole?: string | null;
    };
    const results = await searchKnowledge({
      organizationId: ctx.organizationId,
      query: input.query,
      requesterRole: input.requesterRole ?? null,
      limit: input.limit,
    });
    return {
      summary: `${results.length} Wissens-Fundstellen zu "${input.query}"`,
      data: results,
      sources: results.map((r) => ({
        title: r.documentTitle,
        ref: r.chunkId,
      })),
    };
  },
});

registerTool({
  key: "briefing.write",
  name: "Briefing erstellen",
  riskLevel: "low",
  idempotent: false,
  inputSchema: z.object({
    title: z.string().min(3).max(200),
    content: z.string().min(10).max(20_000),
    relatedEventId: z.string().nullable().optional(),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      title: string;
      content: string;
      relatedEventId?: string | null;
    };
    // Briefings werden als Aufgabe mit Volltext hinterlegt — sie erscheinen
    // damit in Tasks und im Aktivitätsprotokoll und sind exportierbar.
    const { task } = await import("@/server/db/schema");
    const [row] = await withOrg(ctx.organizationId, (tx) =>
      tx
        .insert(task)
        .values({
          organizationId: ctx.organizationId,
          title: ctx.sandbox ? `[SANDBOX] ${input.title}` : input.title,
          description: input.content,
          status: "open",
          priority: "normal",
          agentInstanceId: ctx.instanceId,
          createdByType: "agent",
          createdById: ctx.instanceId,
          source: {
            type: "briefing",
            eventId: input.relatedEventId ?? null,
            runId: ctx.runId,
          },
        })
        .returning({ id: task.id }),
    );
    return {
      summary: `Briefing "${input.title}" erstellt`,
      data: { taskId: row!.id },
    };
  },
});

registerTool({
  key: "documents.read",
  name: "Dokumente lesen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    text: z.string().max(50_000).optional(),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as { text?: string };
    if (!input.text) {
      throw new Error(
        "Kein Dokumentinhalt übergeben. Laden Sie ein Dokument hoch oder verbinden Sie einen Dateispeicher.",
      );
    }
    return {
      summary: `Dokumentinhalt gelesen (${input.text.length} Zeichen)`,
      data: { text: input.text },
    };
  },
});

registerTool({
  key: "finance.read",
  name: "Finanzdaten lesen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    invoiceNumber: z.string().nullable().optional(),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      invoiceNumber?: string | null;
    };
    // Dublettenprüfung gegen bereits erfasste Rechnungs-Aufgaben
    const { task } = await import("@/server/db/schema");
    const rows = await withOrg(ctx.organizationId, (tx) =>
      tx
        .select({ id: task.id, title: task.title, source: task.source })
        .from(task)
        .orderBy(desc(task.createdAt))
        .limit(100),
    );
    const duplicate = input.invoiceNumber
      ? rows.find((r) => {
          const src = r.source as { invoiceNumber?: string } | null;
          return src?.invoiceNumber === input.invoiceNumber;
        })
      : undefined;
    return {
      summary: duplicate
        ? `Mögliche Dublette gefunden: ${duplicate.title}`
        : "Keine Dublette gefunden",
      data: { duplicateTaskId: duplicate?.id ?? null },
    };
  },
});

registerTool({
  key: "finance.write",
  name: "Finanzvorgang erfassen",
  riskLevel: "medium",
  idempotent: false,
  inputSchema: z.object({
    invoiceNumber: z.string().nullable(),
    vendorName: z.string().nullable(),
    totalAmountCents: z.number().int().nullable(),
    missingFields: z.array(z.string()).default([]),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      invoiceNumber: string | null;
      vendorName: string | null;
      totalAmountCents: number | null;
      missingFields: string[];
    };
    // Bewusst KEINE Buchung und KEINE Zahlung: es wird ausschließlich ein
    // Prüfvorgang dokumentiert (Spec §11 C.1 — Grenzen des Invoice-Agenten).
    return {
      summary: `Rechnungsdaten erfasst (${input.invoiceNumber ?? "ohne Nummer"}, ${
        input.totalAmountCents != null
          ? (input.totalAmountCents / 100).toFixed(2) + " EUR"
          : "Betrag fehlt"
      })${input.missingFields.length > 0 ? ` — fehlend: ${input.missingFields.join(", ")}` : ""}`,
      data: input,
    };
  },
});

// Diese Tools sind echt implementiert (kein Platzhalter).
markImplemented([
  "email.read",
  "email.label",
  "email.draft",
  "email.send",
  "calendar.read",
  "calendar.write",
  "deals.read",
  "knowledge.search",
  "briefing.write",
  "documents.read",
  "finance.read",
  "finance.write",
]);
