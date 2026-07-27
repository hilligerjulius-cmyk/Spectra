import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { agentInstance } from "./agents";

/**
 * Zeitpläne für Agentenläufe.
 *
 * Die Zeitpläne liegen absichtlich hier und nicht in pg-boss: So unterliegen
 * sie der Mandantentrennung, sind im Audit-Log nachvollziehbar und lassen sich
 * aus der Anwendung ändern, ohne den Worker neu zu starten. pg-boss liefert nur
 * den Herzschlag — jede Minute prüft ein Job, welche Zeitpläne fällig sind.
 */
export const agentSchedule = pgTable(
  "agent_schedule",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    agentInstanceId: text("agent_instance_id")
      .notNull()
      .references(() => agentInstance.id, { onDelete: "cascade" }),
    capabilityKey: text("capability_key").notNull(),
    /** hourly | daily | weekday | weekly */
    frequency: text("frequency").notNull(),
    hour: integer("hour").notNull().default(7),
    minute: integer("minute").notNull().default(0),
    /** 1 (Montag) bis 7 (Sonntag), nur bei "weekly" gesetzt. */
    weekday: integer("weekday"),
    /** IANA-Zeitzone der Organisation, z. B. "Europe/Berlin". */
    timezone: text("timezone").notNull().default("Europe/Berlin"),
    enabled: boolean("enabled").notNull().default(true),
    /**
     * Zuletzt ausgeführtes Ausführungsfenster (siehe jobs/schedule.ts).
     * Verhindert Doppelläufe über Neustarts und Sommerzeitwechsel hinweg.
     */
    lastRunSlot: text("last_run_slot"),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastRunId: text("last_run_id"),
    /** Kurzfassung des letzten Ergebnisses — für die Oberfläche. */
    lastStatus: text("last_status"),
    /**
     * Aufeinanderfolgende Fehlläufe. Ab einer Grenze wird der Zeitplan
     * automatisch abgeschaltet: Ein dauerhaft scheiternder Zeitplan würde sonst
     * unbemerkt Kontingent verbrauchen.
     */
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    /** Grund, falls der Zeitplan automatisch abgeschaltet wurde. */
    disabledReason: text("disabled_reason"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Ein Zeitplan je Fähigkeit und Agent — verhindert versehentliche
    // Doppelplanung derselben Arbeit.
    uniqueIndex("agent_schedule_instance_capability_uidx").on(
      t.agentInstanceId,
      t.capabilityKey,
    ),
    index("agent_schedule_enabled_idx").on(t.enabled),
    index("agent_schedule_org_idx").on(t.organizationId),
  ],
);
