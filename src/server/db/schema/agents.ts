import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/**
 * Gebuchte Agenten einer Organisation. Die Katalogdefinition (Fähigkeiten,
 * Grenzen, Systemprompt) lebt versioniert im Code (src/server/agents/catalog);
 * hier liegt ausschließlich die organisationsspezifische Konfiguration.
 */
export const agentInstance = pgTable(
  "agent_instance",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    definitionSlug: text("definition_slug").notNull(),
    /** Vom Kunden vergebener Anzeigename (Default: Persona-Name aus dem Katalog). */
    displayName: text("display_name").notNull(),
    /** sandbox | active | paused | disabled */
    status: text("status").notNull().default("sandbox"),
    /** capabilityKey → Automatisierungsstufe (0–5, gedeckelt durch maxAutomationLevel). */
    automationOverrides: jsonb("automation_overrides")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    /** Explizit deaktivierte Fähigkeiten (capabilityKeys). */
    disabledCapabilities: jsonb("disabled_capabilities")
      .$type<string[]>()
      .notNull()
      .default([]),
    /** Freigegebene Tool-Schlüssel; Default = alle von den Fähigkeiten benötigten. */
    allowedTools: jsonb("allowed_tools").$type<string[]>().notNull().default([]),
    /** Freigegebene Datenquellen-Schlüssel (Connector-/Quellen-IDs). */
    allowedDataSources: jsonb("allowed_data_sources")
      .$type<string[]>()
      .notNull()
      .default([]),
    /** Verantwortliche Person für Freigaben/Eskalationen. */
    responsibleUserId: text("responsible_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Kostenlimit je Kalendermonat in Cent (LLM-/Tool-Kosten), null = Org-Default. */
    monthlyCostLimitCents: integer("monthly_cost_limit_cents"),
    settings: jsonb("settings")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    sandboxPassedAt: timestamp("sandbox_passed_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("agent_instance_org_slug_uidx").on(
      t.organizationId,
      t.definitionSlug,
    ),
    index("agent_instance_org_status_idx").on(t.organizationId, t.status),
  ],
);
