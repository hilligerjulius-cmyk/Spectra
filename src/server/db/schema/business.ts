import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { agentInstance } from "./agents";

/**
 * Fachdatenbestände der Plattform.
 *
 * Diese Tabellen sind bewusst schlank („light"): Sie sind kein Ersatz für ein
 * gewachsenes CRM, Helpdesk oder HR-System, sondern der Datenbestand, auf dem
 * die Agenten arbeiten können, wenn kein Fremdsystem angebunden ist. Wird
 * später ein Connector ergänzt, bleibt die Werkzeugschnittstelle dieselbe —
 * nur die Datenquelle wechselt.
 *
 * Vorbild ist die bestehende `deal`-Tabelle (CRM-light) in connectors.ts.
 */

/* ------------------------------------------------------------------------- */
/* Kontakte                                                                   */
/* ------------------------------------------------------------------------- */

/** Personen und Firmen — gemeinsame Grundlage für CRM und Kundenservice. */
export const contact = pgTable(
  "contact",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    company: text("company"),
    role: text("role"),
    /** lead | kunde | partner | lieferant | sonstige */
    kind: text("kind").notNull().default("lead"),
    /**
     * Sperrvermerk. Wird von jedem Werkzeug beachtet, das eine Ansprache
     * vorbereitet — ein Widerspruch gegen Werbung darf nicht davon abhängen,
     * dass ein Agent ihn zufällig im Notizfeld liest.
     */
    doNotContact: boolean("do_not_contact").notNull().default(false),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    demo: boolean("demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("contact_org_kind_idx").on(t.organizationId, t.kind),
    // E-Mail ist optional, aber wenn vorhanden je Organisation eindeutig —
    // sonst entstehen bei jedem CSV-Import Dubletten.
    uniqueIndex("contact_org_email_uidx").on(t.organizationId, t.email),
  ],
);

/* ------------------------------------------------------------------------- */
/* Tickets                                                                    */
/* ------------------------------------------------------------------------- */

/** Serviceanfragen — Grundlage für Routing, Eskalation und Qualitätsanalyse. */
export const ticket = pgTable(
  "ticket",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Fortlaufende, für Menschen lesbare Nummer je Organisation. */
    reference: text("reference").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    contactId: text("contact_id").references(() => contact.id, {
      onDelete: "set null",
    }),
    /** Freitext, falls kein Kontakt hinterlegt ist. */
    requesterEmail: text("requester_email"),
    /** neu | in_bearbeitung | wartet_auf_kunde | geloest | geschlossen */
    status: text("status").notNull().default("neu"),
    /** low | normal | high | urgent */
    priority: text("priority").notNull().default("normal"),
    /** Fachliche Einordnung, z. B. "technik", "abrechnung", "reklamation". */
    category: text("category"),
    /** Zuständiges Team als Freitext — kein eigenes Team-Modell nötig. */
    assignedTeam: text("assigned_team"),
    assignedUserId: text("assigned_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Agent, der zuletzt an diesem Ticket gearbeitet hat. */
    lastAgentInstanceId: text("last_agent_instance_id").references(
      () => agentInstance.id,
      { onDelete: "set null" },
    ),
    /** Zugesagte Reaktionszeit — Grundlage für Eskalationen. */
    dueAt: timestamp("due_at", { withTimezone: true }),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    /** Kundenzufriedenheit 1–5, falls erhoben. */
    satisfaction: integer("satisfaction"),
    demo: boolean("demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ticket_org_status_idx").on(t.organizationId, t.status),
    index("ticket_org_due_idx").on(t.organizationId, t.dueAt),
    uniqueIndex("ticket_org_reference_uidx").on(t.organizationId, t.reference),
  ],
);

/* ------------------------------------------------------------------------- */
/* Personalstammdaten                                                         */
/* ------------------------------------------------------------------------- */

/**
 * Beschäftigte — absichtlich auf das Nötige begrenzt.
 *
 * Was hier bewusst **nicht** steht: Gehalt, Bankverbindung, Geburtsdatum,
 * Gesundheitsdaten, Beurteilungen. Kein Agent braucht diese Daten für die
 * abgebildeten Fähigkeiten, und was nicht gespeichert ist, kann nicht
 * abfließen. Wer Abrechnung braucht, bindet ein Fachsystem an.
 */
export const employee = pgTable(
  "employee",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    workEmail: text("work_email"),
    /** Verknüpfung zum Plattformkonto, falls vorhanden. */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    jobTitle: text("job_title"),
    department: text("department"),
    managerEmployeeId: text("manager_employee_id"),
    /** aktiv | eintritt_geplant | beurlaubt | ausgetreten */
    status: text("status").notNull().default("aktiv"),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    /** Urlaubstage pro Jahr — für die formale Antragsprüfung. */
    vacationDaysPerYear: integer("vacation_days_per_year"),
    demo: boolean("demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("employee_org_status_idx").on(t.organizationId, t.status),
    uniqueIndex("employee_org_email_uidx").on(t.organizationId, t.workEmail),
  ],
);

/** Abwesenheitsanträge — Urlaub, Krankheit, Sonstiges. */
export const absence = pgTable(
  "absence",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    /** urlaub | krankheit | sonderurlaub | unbezahlt */
    kind: text("kind").notNull().default("urlaub"),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    workingDays: integer("working_days").notNull(),
    /** beantragt | genehmigt | abgelehnt | zurueckgezogen */
    status: text("status").notNull().default("beantragt"),
    note: text("note"),
    /**
     * Ergebnis der formalen Prüfung durch einen Agenten. Bewusst getrennt vom
     * Status: ein Agent prüft die Form, die Entscheidung trifft ein Mensch.
     */
    checkResult: jsonb("check_result").$type<Record<string, unknown>>(),
    decidedByUserId: text("decided_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    demo: boolean("demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("absence_org_status_idx").on(t.organizationId, t.status),
    index("absence_employee_idx").on(t.employeeId, t.startDate),
  ],
);
