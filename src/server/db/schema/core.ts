import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";

/**
 * Revisionssicheres Audit-Log (append-only; Updates/Deletes sind für die
 * App-Rolle nicht gegrantet). Jede sicherheits- oder agentenrelevante Aktion
 * erzeugt einen Eintrag.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** "user" | "agent" | "system" */
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    actorLabel: text("actor_label").notNull(),
    /** z. B. "auth.login", "agent.run.completed", "approval.decided" */
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_log_org_created_idx").on(t.organizationId, t.createdAt),
    index("audit_log_action_idx").on(t.action),
  ],
);

/**
 * Mail-Outbox: Ohne SMTP-Konfiguration werden ausgehende E-Mails hier
 * gespeichert und im UI angezeigt (kein vorgetäuschter Versand). Mit SMTP
 * dient die Tabelle als Versandprotokoll.
 */
export const mailOutbox = pgTable(
  "mail_outbox",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    bodyText: text("body_text").notNull(),
    bodyHtml: text("body_html"),
    /** auth | invitation | notification | digest | agent | billing */
    category: text("category").notNull(),
    /** stored (Outbox, nicht versendet) | sent | failed */
    status: text("status").notNull(),
    provider: text("provider").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("mail_outbox_org_idx").on(t.organizationId, t.createdAt)],
);
