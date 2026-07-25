import { and, desc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { withOrg } from "@/server/db/client";
import {
  absence,
  contact,
  deal,
  employee,
  knowledgeDocument,
  ticket,
} from "@/server/db/schema";
import { recordAudit } from "@/server/audit";
import { markImplemented, registerTool } from "./tools";

/**
 * Fachwerkzeuge auf den eigenen Datenbeständen (Migration 0018/0019).
 *
 * Diese Werkzeuge ersetzen kein Fremdsystem. Sie geben den Agenten einen
 * echten Datenbestand, solange kein CRM, Helpdesk oder HR-System angebunden
 * ist. Wird später ein Connector ergänzt, bleibt die Schnittstelle gleich —
 * nur die Quelle wechselt.
 *
 * Zwei Regeln gelten durchgehend:
 *  - Lesende Werkzeuge geben nur, was für die Aufgabe nötig ist. Bei
 *    Personaldaten heißt das ausdrücklich: keine Gehälter, keine
 *    Geburtsdaten, keine Beurteilungen — sie stehen nicht einmal im Schema.
 *  - Schreibende Werkzeuge legen keine neuen Personen an, wenn sie nur ein
 *    Feld ändern sollen, und beachten Sperrvermerke ohne Ausnahme.
 */

/* ------------------------------------------------------------------------- */
/* Tickets                                                                    */
/* ------------------------------------------------------------------------- */

registerTool({
  key: "tickets.read",
  name: "Tickets lesen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    status: z.array(z.string()).optional(),
    reference: z.string().max(60).nullable().optional(),
    /** Nur Tickets, deren zugesagte Reaktionszeit überschritten ist. */
    overdueOnly: z.boolean().default(false),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      status?: string[];
      reference?: string | null;
      overdueOnly: boolean;
      limit: number;
    };

    const conditions: SQL[] = [];
    if (input.reference) conditions.push(eq(ticket.reference, input.reference));
    if (input.status && input.status.length > 0) {
      conditions.push(
        or(...input.status.map((s) => eq(ticket.status, s)))!,
      );
    }
    if (input.overdueOnly) {
      conditions.push(sql`${ticket.dueAt} < now()`);
      conditions.push(isNull(ticket.resolvedAt));
    }

    const rows = await withOrg(ctx.organizationId, (tx) =>
      tx
        .select()
        .from(ticket)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(ticket.createdAt))
        .limit(input.limit),
    );

    const now = Date.now();
    return {
      summary: `${rows.length} Ticket(s) gelesen${input.overdueOnly ? " (nur überfällige)" : ""}.`,
      data: rows.map((t) => ({
        id: t.id,
        reference: t.reference,
        subject: t.subject,
        body: t.body,
        status: t.status,
        priority: t.priority,
        category: t.category,
        assignedTeam: t.assignedTeam,
        requesterEmail: t.requesterEmail,
        satisfaction: t.satisfaction,
        dueAt: t.dueAt?.toISOString() ?? null,
        overdue:
          t.dueAt !== null && t.resolvedAt === null && t.dueAt.getTime() < now,
        firstResponseMinutes:
          t.firstResponseAt !== null
            ? Math.round(
                (t.firstResponseAt.getTime() - t.createdAt.getTime()) / 60_000,
              )
            : null,
        resolutionMinutes:
          t.resolvedAt !== null
            ? Math.round((t.resolvedAt.getTime() - t.createdAt.getTime()) / 60_000)
            : null,
        ageMinutes: Math.round((now - t.createdAt.getTime()) / 60_000),
      })),
      sources: rows.map((t) => ({ title: t.subject, ref: t.reference })),
    };
  },
});

const ticketWriteSchema = z.object({
  /** Bestandsticket ändern (reference) oder neues anlegen (subject + body). */
  reference: z.string().max(60).nullable().optional(),
  subject: z.string().min(3).max(200).nullable().optional(),
  body: z.string().min(1).max(20_000).nullable().optional(),
  requesterEmail: z.string().email().nullable().optional(),
  status: z
    .enum(["neu", "in_bearbeitung", "wartet_auf_kunde", "geloest", "geschlossen"])
    .nullable()
    .optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  assignedTeam: z.string().max(80).nullable().optional(),
  /** Frist in Stunden ab jetzt — nur beim Anlegen. */
  dueInHours: z.number().int().min(1).max(8760).nullable().optional(),
});

registerTool({
  key: "tickets.write",
  name: "Ticket anlegen oder aktualisieren",
  riskLevel: "low",
  idempotent: false,
  inputSchema: ticketWriteSchema,
  async execute(ctx, rawInput) {
    const input = ticketWriteSchema.parse(rawInput);

    /* Bestandsticket aktualisieren */
    if (input.reference) {
      const [existing] = await withOrg(ctx.organizationId, (tx) =>
        tx.select().from(ticket).where(eq(ticket.reference, input.reference!)),
      );
      if (!existing) {
        throw new Error(
          `Ticket "${input.reference}" existiert nicht. Es wurde keines angelegt — eine unbekannte Referenz ist ein Hinweis auf einen Fehler, nicht auf ein fehlendes Ticket.`,
        );
      }

      const changes: Record<string, unknown> = {};
      if (input.status) changes.status = input.status;
      if (input.priority) changes.priority = input.priority;
      if (input.category) changes.category = input.category;
      if (input.assignedTeam) changes.assignedTeam = input.assignedTeam;
      if (Object.keys(changes).length === 0) {
        return {
          summary: `Ticket ${existing.reference}: keine Änderung übergeben.`,
          data: { reference: existing.reference, changed: false },
        };
      }

      // Erste Reaktion und Lösungszeitpunkt sind Messgrößen — sie werden
      // gesetzt, wenn sie tatsächlich eintreten, und nie überschrieben.
      if (
        existing.firstResponseAt === null &&
        (input.status === "in_bearbeitung" || input.assignedTeam)
      ) {
        changes.firstResponseAt = new Date();
      }
      if (
        existing.resolvedAt === null &&
        (input.status === "geloest" || input.status === "geschlossen")
      ) {
        changes.resolvedAt = new Date();
      }
      changes.lastAgentInstanceId = ctx.instanceId;

      await withOrg(ctx.organizationId, (tx) =>
        tx.update(ticket).set(changes).where(eq(ticket.id, existing.id)),
      );
      await recordAudit({
        organizationId: ctx.organizationId,
        actorType: "agent",
        actorId: ctx.instanceId,
        actorLabel: "Agent",
        action: "ticket.updated",
        targetType: "ticket",
        targetId: existing.id,
        summary: `Ticket ${existing.reference} aktualisiert: ${Object.keys(changes)
          .filter((k) => k !== "lastAgentInstanceId")
          .join(", ")}.`,
        metadata: { runId: ctx.runId },
      });

      return {
        summary: `Ticket ${existing.reference} aktualisiert (${Object.keys(changes)
          .filter((k) => k !== "lastAgentInstanceId")
          .join(", ")}).`,
        data: { reference: existing.reference, changed: true, changes },
      };
    }

    /* Neues Ticket anlegen */
    if (!input.subject || !input.body) {
      throw new Error(
        "Zum Anlegen sind subject und body nötig; zum Ändern eine reference.",
      );
    }

    const reference = await nextTicketReference(ctx.organizationId);
    const [created] = await withOrg(ctx.organizationId, (tx) =>
      tx
        .insert(ticket)
        .values({
          organizationId: ctx.organizationId,
          reference,
          subject: input.subject!,
          body: input.body!,
          requesterEmail: input.requesterEmail ?? null,
          status: input.status ?? "neu",
          priority: input.priority ?? "normal",
          category: input.category ?? null,
          assignedTeam: input.assignedTeam ?? null,
          dueAt: input.dueInHours
            ? new Date(Date.now() + input.dueInHours * 3_600_000)
            : null,
          lastAgentInstanceId: ctx.instanceId,
        })
        .returning({ id: ticket.id }),
    );

    return {
      summary: `Ticket ${reference} angelegt: ${input.subject}`,
      data: { id: created!.id, reference, changed: true },
    };
  },
});

/**
 * Nächste Ticketnummer im Format `T-<jahr>-<laufend>`.
 *
 * Der eindeutige Index auf (organization_id, reference) ist die eigentliche
 * Absicherung: Bei einem Wettlauf schlägt das INSERT fehl, statt zwei Tickets
 * dieselbe Nummer zu geben.
 */
async function nextTicketReference(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `T-${year}-`;
  const rows = await withOrg(organizationId, (tx) =>
    tx
      .select({ reference: ticket.reference })
      .from(ticket)
      .where(sql`${ticket.reference} LIKE ${prefix + "%"}`)
      .orderBy(desc(ticket.reference))
      .limit(1),
  );
  const last = rows[0]?.reference;
  const lastNumber = last ? Number.parseInt(last.slice(prefix.length), 10) : 0;
  const next = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/* ------------------------------------------------------------------------- */
/* Kontakte                                                                   */
/* ------------------------------------------------------------------------- */

registerTool({
  key: "contacts.read",
  name: "Kontakte lesen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    kind: z.array(z.string()).optional(),
    email: z.string().max(200).nullable().optional(),
    search: z.string().max(120).nullable().optional(),
    /** Gesperrte Kontakte mitliefern? Standard: nein. */
    includeDoNotContact: z.boolean().default(false),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      kind?: string[];
      email?: string | null;
      search?: string | null;
      includeDoNotContact: boolean;
      limit: number;
    };

    const conditions: SQL[] = [];
    if (input.email) conditions.push(eq(contact.email, input.email));
    if (input.kind && input.kind.length > 0) {
      conditions.push(or(...input.kind.map((k) => eq(contact.kind, k)))!);
    }
    if (input.search) {
      const pattern = `%${input.search}%`;
      conditions.push(
        or(
          sql`${contact.fullName} ILIKE ${pattern}`,
          sql`${contact.company} ILIKE ${pattern}`,
        )!,
      );
    }
    // Gesperrte Kontakte bleiben standardmäßig außen vor. Ein Agent, der eine
    // Ansprache vorbereitet, soll sie gar nicht erst sehen.
    if (!input.includeDoNotContact) {
      conditions.push(eq(contact.doNotContact, false));
    }

    const rows = await withOrg(ctx.organizationId, (tx) =>
      tx
        .select()
        .from(contact)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(contact.updatedAt))
        .limit(input.limit),
    );

    return {
      summary: `${rows.length} Kontakt(e) gelesen${input.includeDoNotContact ? " (inklusive gesperrter)" : " (gesperrte ausgenommen)"}.`,
      data: rows.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
        company: c.company,
        role: c.role,
        kind: c.kind,
        doNotContact: c.doNotContact,
        tags: c.tags,
        notes: c.notes,
        lastContactedAt: c.lastContactedAt?.toISOString() ?? null,
      })),
    };
  },
});

const contactWriteSchema = z.object({
  email: z.string().email().nullable().optional(),
  fullName: z.string().min(2).max(200).nullable().optional(),
  phone: z.string().max(60).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  role: z.string().max(120).nullable().optional(),
  kind: z
    .enum(["lead", "kunde", "partner", "lieferant", "sonstige"])
    .nullable()
    .optional(),
  notes: z.string().max(4000).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).nullable().optional(),
  /**
   * Sperrvermerk setzen. Bewusst nur in eine Richtung: Ein Agent darf eine
   * Sperre setzen, aber niemals aufheben — ein Widerspruch gegen Werbung wird
   * nicht von der Maschine zurückgenommen.
   */
  setDoNotContact: z.boolean().nullable().optional(),
  markContactedNow: z.boolean().default(false),
});

registerTool({
  key: "contacts.write",
  name: "Kontakt anlegen oder aktualisieren",
  riskLevel: "low",
  idempotent: false,
  inputSchema: contactWriteSchema,
  async execute(ctx, rawInput) {
    const input = contactWriteSchema.parse(rawInput);
    if (!input.email && !input.fullName) {
      throw new Error("Ohne E-Mail oder Namen lässt sich kein Kontakt zuordnen.");
    }

    const existing = input.email
      ? (
          await withOrg(ctx.organizationId, (tx) =>
            tx.select().from(contact).where(eq(contact.email, input.email!)),
          )
        )[0]
      : undefined;

    const changes: Record<string, unknown> = {};
    if (input.fullName) changes.fullName = input.fullName;
    if (input.phone) changes.phone = input.phone;
    if (input.company) changes.company = input.company;
    if (input.role) changes.role = input.role;
    if (input.kind) changes.kind = input.kind;
    if (input.notes) changes.notes = input.notes;
    if (input.tags) changes.tags = input.tags;
    if (input.markContactedNow) changes.lastContactedAt = new Date();
    if (input.setDoNotContact === true) changes.doNotContact = true;

    if (existing) {
      if (Object.keys(changes).length === 0) {
        return {
          summary: `Kontakt ${existing.fullName}: keine Änderung übergeben.`,
          data: { id: existing.id, created: false, changed: false },
        };
      }
      await withOrg(ctx.organizationId, (tx) =>
        tx.update(contact).set(changes).where(eq(contact.id, existing.id)),
      );
      return {
        summary: `Kontakt ${existing.fullName} aktualisiert (${Object.keys(changes).join(", ")}).`,
        data: { id: existing.id, created: false, changed: true, changes },
      };
    }

    if (!input.fullName) {
      throw new Error(
        `Kein Kontakt mit "${input.email}" vorhanden. Zum Anlegen ist ein Name nötig — er wird nicht aus der E-Mail-Adresse geraten.`,
      );
    }

    const [created] = await withOrg(ctx.organizationId, (tx) =>
      tx
        .insert(contact)
        .values({
          organizationId: ctx.organizationId,
          fullName: input.fullName!,
          email: input.email ?? null,
          phone: input.phone ?? null,
          company: input.company ?? null,
          role: input.role ?? null,
          kind: input.kind ?? "lead",
          notes: input.notes ?? null,
          tags: input.tags ?? [],
          doNotContact: input.setDoNotContact === true,
          lastContactedAt: input.markContactedNow ? new Date() : null,
        })
        .returning({ id: contact.id }),
    );

    return {
      summary: `Kontakt "${input.fullName}" angelegt.`,
      data: { id: created!.id, created: true, changed: true },
    };
  },
});

/* ------------------------------------------------------------------------- */
/* CRM (Kontakte + Deals gemeinsam)                                           */
/* ------------------------------------------------------------------------- */

registerTool({
  key: "crm.read",
  name: "CRM-Daten lesen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    stage: z.array(z.string()).optional(),
    /** Nur Deals ohne Aktivität seit N Tagen — Grundlage für Follow-ups. */
    staleAfterDays: z.number().int().min(1).max(365).nullable().optional(),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      stage?: string[];
      staleAfterDays?: number | null;
      limit: number;
    };

    const conditions = [eq(deal.doNotContact, false)];
    if (input.stage && input.stage.length > 0) {
      conditions.push(or(...input.stage.map((s) => eq(deal.stage, s)))!);
    }
    if (input.staleAfterDays) {
      const cutoff = new Date(
        Date.now() - input.staleAfterDays * 24 * 3_600_000,
      );
      conditions.push(
        or(
          isNull(deal.lastActivityAt),
          sql`${deal.lastActivityAt} < ${cutoff.toISOString()}`,
        )!,
      );
    }

    const { deals, contacts } = await withOrg(ctx.organizationId, async (tx) => ({
      deals: await tx
        .select()
        .from(deal)
        .where(and(...conditions))
        .orderBy(desc(deal.updatedAt))
        .limit(input.limit),
      contacts: await tx
        .select({
          fullName: contact.fullName,
          email: contact.email,
          company: contact.company,
          kind: contact.kind,
        })
        .from(contact)
        .where(eq(contact.doNotContact, false))
        .limit(input.limit),
    }));

    const totalValue = deals.reduce((s, d) => s + (d.valueCents ?? 0), 0);
    return {
      summary: `${deals.length} Vorgang/Vorgänge und ${contacts.length} Kontakt(e) gelesen. Gesperrte sind ausgenommen.`,
      data: {
        deals: deals.map((d) => ({
          id: d.id,
          name: d.name,
          company: d.company,
          contactEmail: d.contactEmail,
          stage: d.stage,
          valueCents: d.valueCents,
          proposalSentAt: d.proposalSentAt?.toISOString() ?? null,
          lastActivityAt: d.lastActivityAt?.toISOString() ?? null,
          daysSinceActivity:
            d.lastActivityAt !== null
              ? Math.floor(
                  (Date.now() - d.lastActivityAt.getTime()) / (24 * 3_600_000),
                )
              : null,
        })),
        contacts,
        // Summe nur, wenn überall ein Betrag steht — sonst wäre sie irreführend.
        totalValueCents: deals.every((d) => d.valueCents !== null)
          ? totalValue
          : null,
        totalValueNote: deals.every((d) => d.valueCents !== null)
          ? null
          : "Summe nicht ausgewiesen: bei mindestens einem Vorgang fehlt der Betrag.",
      },
    };
  },
});

const crmWriteSchema = z.object({
  /** Vorgang über die Kontakt-E-Mail zuordnen. */
  contactEmail: z.string().email(),
  stage: z
    .enum(["lead", "angebot_versendet", "verhandlung", "gewonnen", "verloren"])
    .nullable()
    .optional(),
  valueCents: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  markActivityNow: z.boolean().default(true),
});

registerTool({
  key: "crm.write",
  name: "CRM-Vorgang aktualisieren",
  riskLevel: "low",
  idempotent: false,
  inputSchema: crmWriteSchema,
  async execute(ctx, rawInput) {
    const input = crmWriteSchema.parse(rawInput);

    const [existing] = await withOrg(ctx.organizationId, (tx) =>
      tx.select().from(deal).where(eq(deal.contactEmail, input.contactEmail)),
    );
    if (!existing) {
      throw new Error(
        `Kein Vorgang zu "${input.contactEmail}" vorhanden. Es wurde keiner angelegt — ein Vorgang entsteht durch eine Geschäftsentscheidung, nicht durch einen Agentenlauf.`,
      );
    }
    // Sperrvermerk gilt auch für reine Datenpflege: Wer widersprochen hat,
    // soll nicht durch Aktivitätsvermerke wieder in Kampagnen geraten.
    if (existing.doNotContact) {
      throw new Error(
        `Vorgang "${existing.name}" trägt einen Sperrvermerk und wird nicht verändert.`,
      );
    }

    const changes: Record<string, unknown> = {};
    if (input.stage) changes.stage = input.stage;
    if (input.valueCents !== null && input.valueCents !== undefined) {
      changes.valueCents = input.valueCents;
    }
    if (input.notes) changes.notes = input.notes;
    if (input.markActivityNow) changes.lastActivityAt = new Date();
    if (input.stage === "angebot_versendet" && existing.proposalSentAt === null) {
      changes.proposalSentAt = new Date();
    }

    if (Object.keys(changes).length === 0) {
      return {
        summary: `Vorgang "${existing.name}": keine Änderung übergeben.`,
        data: { id: existing.id, changed: false },
      };
    }

    await withOrg(ctx.organizationId, (tx) =>
      tx.update(deal).set(changes).where(eq(deal.id, existing.id)),
    );
    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "agent",
      actorId: ctx.instanceId,
      actorLabel: "Agent",
      action: "crm.deal.updated",
      targetType: "deal",
      targetId: existing.id,
      summary: `Vorgang "${existing.name}" aktualisiert: ${Object.keys(changes).join(", ")}.`,
      metadata: { runId: ctx.runId },
    });

    return {
      summary: `Vorgang "${existing.name}" aktualisiert (${Object.keys(changes).join(", ")}).`,
      data: { id: existing.id, changed: true, changes },
    };
  },
});

/* ------------------------------------------------------------------------- */
/* Personal                                                                   */
/* ------------------------------------------------------------------------- */

registerTool({
  key: "hr.read",
  name: "Personaldaten lesen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    workEmail: z.string().max(200).nullable().optional(),
    status: z.array(z.string()).optional(),
    department: z.string().max(120).nullable().optional(),
    /** Abwesenheiten mitliefern (nur formale Angaben, kein Grund). */
    includeAbsences: z.boolean().default(false),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      workEmail?: string | null;
      status?: string[];
      department?: string | null;
      includeAbsences: boolean;
      limit: number;
    };

    const conditions: SQL[] = [];
    if (input.workEmail) conditions.push(eq(employee.workEmail, input.workEmail));
    if (input.department) conditions.push(eq(employee.department, input.department));
    if (input.status && input.status.length > 0) {
      conditions.push(or(...input.status.map((s) => eq(employee.status, s)))!);
    }

    const people = await withOrg(ctx.organizationId, (tx) =>
      tx
        .select()
        .from(employee)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(employee.fullName)
        .limit(input.limit),
    );

    let absences: {
      employeeWorkEmail: string | null;
      kind: string;
      startDate: string;
      endDate: string;
      workingDays: number;
      status: string;
    }[] = [];
    if (input.includeAbsences && people.length > 0) {
      const rows = await withOrg(ctx.organizationId, (tx) =>
        tx
          .select()
          .from(absence)
          .orderBy(desc(absence.startDate))
          .limit(200),
      );
      const byId = new Map(people.map((p) => [p.id, p]));
      absences = rows
        .filter((a) => byId.has(a.employeeId))
        .map((a) => ({
          employeeWorkEmail: byId.get(a.employeeId)!.workEmail,
          kind: a.kind,
          startDate: a.startDate.toISOString().slice(0, 10),
          endDate: a.endDate.toISOString().slice(0, 10),
          workingDays: a.workingDays,
          status: a.status,
          // `note` reist bewusst nicht mit: Ein Krankheitsgrund gehört nicht in
          // einen Agentenlauf, der ihn ins Protokoll oder in einen Entwurf trägt.
        }));
    }

    return {
      summary: `${people.length} Beschäftigte(r) gelesen${input.includeAbsences ? `, ${absences.length} Abwesenheit(en)` : ""}. Ohne Vergütungs- und Gesundheitsdaten — sie werden nicht gespeichert.`,
      data: {
        employees: people.map((p) => ({
          fullName: p.fullName,
          workEmail: p.workEmail,
          jobTitle: p.jobTitle,
          department: p.department,
          status: p.status,
          startDate: p.startDate?.toISOString().slice(0, 10) ?? null,
          endDate: p.endDate?.toISOString().slice(0, 10) ?? null,
          vacationDaysPerYear: p.vacationDaysPerYear,
        })),
        absences,
      },
    };
  },
});

const hrWriteSchema = z.object({
  workEmail: z.string().email(),
  /** Formale Prüfung eines Antrags festhalten. */
  absence: z
    .object({
      kind: z.enum(["urlaub", "krankheit", "sonderurlaub", "unbezahlt"]),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      workingDays: z.number().int().min(1).max(365),
      note: z.string().max(500).nullable().optional(),
    })
    .nullable()
    .optional(),
  /** Ergebnis der formalen Prüfung — keine Entscheidung. */
  checkResult: z.record(z.string(), z.unknown()).nullable().optional(),
});

registerTool({
  key: "hr.write",
  name: "Abwesenheitsantrag erfassen",
  riskLevel: "low",
  idempotent: false,
  inputSchema: hrWriteSchema,
  async execute(ctx, rawInput) {
    const input = hrWriteSchema.parse(rawInput);

    const [person] = await withOrg(ctx.organizationId, (tx) =>
      tx.select().from(employee).where(eq(employee.workEmail, input.workEmail)),
    );
    if (!person) {
      throw new Error(
        `Keine Beschäftigte/kein Beschäftigter mit "${input.workEmail}" hinterlegt. Es wurde niemand angelegt — Personalstammdaten entstehen nicht durch einen Agentenlauf.`,
      );
    }
    if (!input.absence) {
      throw new Error("Ohne Antragsdaten gibt es nichts zu erfassen.");
    }

    const start = new Date(`${input.absence.startDate}T00:00:00Z`);
    const end = new Date(`${input.absence.endDate}T00:00:00Z`);
    if (end < start) {
      throw new Error("Das Enddatum liegt vor dem Startdatum.");
    }

    // Der Status bleibt "beantragt". Ein Agent erfasst und prüft die Form —
    // genehmigen darf nur ein Mensch (bindende Vorgabe für Personalvorgänge).
    const [created] = await withOrg(ctx.organizationId, (tx) =>
      tx
        .insert(absence)
        .values({
          organizationId: ctx.organizationId,
          employeeId: person.id,
          kind: input.absence!.kind,
          startDate: start,
          endDate: end,
          workingDays: input.absence!.workingDays,
          note: input.absence!.note ?? null,
          status: "beantragt",
          checkResult: input.checkResult ?? null,
        })
        .returning({ id: absence.id }),
    );

    return {
      summary: `Antrag (${input.absence.kind}, ${input.absence.workingDays} Tage) für ${person.fullName} erfasst — Status "beantragt", Entscheidung liegt beim Menschen.`,
      data: {
        id: created!.id,
        employee: person.fullName,
        status: "beantragt",
        decided: false,
      },
    };
  },
});

/* ------------------------------------------------------------------------- */
/* Dateien                                                                    */
/* ------------------------------------------------------------------------- */

registerTool({
  key: "files.read",
  name: "Dateien lesen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    /** Nur Dokumente einer bestimmten Herkunft. */
    origin: z
      .enum(["upload", "agent_knowledge", "agent_document"])
      .nullable()
      .optional(),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      origin?: "upload" | "agent_knowledge" | "agent_document" | null;
      limit: number;
    };

    // Der Dateibestand der Plattform ist die Wissensablage. Ein externer
    // Dateispeicher (Drive, OneDrive) ist damit nicht angebunden — das steht
    // in der Zusammenfassung, damit es nicht als Vollzugriff missverstanden wird.
    const rows = await withOrg(ctx.organizationId, (tx) =>
      tx
        .select({
          id: knowledgeDocument.id,
          title: knowledgeDocument.title,
          filename: knowledgeDocument.filename,
          mimeType: knowledgeDocument.mimeType,
          sizeBytes: knowledgeDocument.sizeBytes,
          status: knowledgeDocument.status,
          origin: knowledgeDocument.origin,
          accessScope: knowledgeDocument.accessScope,
          createdAt: knowledgeDocument.createdAt,
        })
        .from(knowledgeDocument)
        .where(
          input.origin ? eq(knowledgeDocument.origin, input.origin) : undefined,
        )
        .orderBy(desc(knowledgeDocument.createdAt))
        .limit(input.limit),
    );

    return {
      summary: `${rows.length} Datei(en) in der Wissensablage. Ein externer Dateispeicher ist nicht angebunden.`,
      data: {
        files: rows.map((r) => ({
          id: r.id,
          title: r.title,
          filename: r.filename,
          mimeType: r.mimeType,
          sizeBytes: r.sizeBytes,
          status: r.status,
          origin: r.origin,
          accessScope: r.accessScope,
          createdAt: r.createdAt.toISOString(),
        })),
        source: "knowledge_base",
        externalStorageConnected: false,
      },
      sources: rows.map((r) => ({ title: r.title, ref: r.id })),
    };
  },
});

markImplemented([
  "tickets.read",
  "tickets.write",
  "contacts.read",
  "contacts.write",
  "crm.read",
  "crm.write",
  "hr.read",
  "hr.write",
  "files.read",
]);
