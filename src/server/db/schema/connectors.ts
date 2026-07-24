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

/** Verbundene Integrationen einer Organisation. */
export const integration = pgTable(
  "integration",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** z. B. demo-email, demo-calendar, gmail, google-calendar, webhook, csv */
    connectorKey: text("connector_key").notNull(),
    /** connected | disconnected | needs_credentials | error */
    status: text("status").notNull().default("connected"),
    displayName: text("display_name").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    connectedByUserId: text("connected_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("integration_org_key_uidx").on(t.organizationId, t.connectorKey),
  ],
);

/** E-Mails (Demo-Connector bzw. später Gmail/Outlook). */
export const emailMessage = pgTable(
  "email_message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    integrationId: text("integration_id").references(() => integration.id, {
      onDelete: "set null",
    }),
    /** inbound | outbound */
    direction: text("direction").notNull(),
    /** draft | received | sent | failed */
    status: text("status").notNull(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    /** Triage-Ergebnisse */
    category: text("category"),
    urgency: text("urgency"),
    suspicious: boolean("suspicious").notNull().default(false),
    labels: jsonb("labels").$type<string[]>().notNull().default([]),
    deadlines: jsonb("deadlines").$type<string[]>().notNull().default([]),
    triagedAt: timestamp("triaged_at", { withTimezone: true }),
    createdByAgentInstanceId: text("created_by_agent_instance_id").references(
      () => agentInstance.id,
      { onDelete: "set null" },
    ),
    /** Antwort-/Threadbezug */
    inReplyToId: text("in_reply_to_id"),
    demo: boolean("demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("email_org_direction_idx").on(t.organizationId, t.direction, t.status),
    index("email_org_triaged_idx").on(t.organizationId, t.triagedAt),
  ],
);

/** Kalendertermine (Demo-Connector bzw. später Google/Microsoft Calendar). */
export const calendarEvent = pgTable(
  "calendar_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    integrationId: text("integration_id").references(() => integration.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    attendees: jsonb("attendees").$type<string[]>().notNull().default([]),
    demo: boolean("demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("calendar_org_start_idx").on(t.organizationId, t.startsAt)],
);

/** Deals (CRM-light für Follow-up-Szenario; Import via CSV/Demo). */
export const deal = pgTable(
  "deal",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    company: text("company").notNull(),
    contactEmail: text("contact_email").notNull(),
    /** lead | angebot_versendet | verhandlung | gewonnen | verloren */
    stage: text("stage").notNull().default("lead"),
    valueCents: integer("value_cents"),
    proposalSentAt: timestamp("proposal_sent_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    /** Sperrvermerk: keine automatische Ansprache */
    doNotContact: boolean("do_not_contact").notNull().default(false),
    notes: text("notes"),
    demo: boolean("demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("deal_org_stage_idx").on(t.organizationId, t.stage)],
);
