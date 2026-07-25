import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/**
 * Plattform-Administration.
 *
 * Diese Tabellen sind absichtlich NICHT mandantenbezogen: Sie gehören dem
 * Betreiber der Plattform, nicht einer Kundenorganisation. Die App-Rolle
 * erhält darauf keinerlei Rechte — Zugriff läuft ausschließlich über die
 * Owner-Verbindung hinter einer Berechtigungsprüfung.
 */

/** Wer darf den Plattform-Adminbereich betreten? */
export const platformAdmin = pgTable(
  "platform_admin",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
      .unique(),
    /** support | admin — Support darf lesen, Admin auch ändern. */
    level: text("level").notNull().default("support"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("platform_admin_user_uidx").on(t.userId)],
);

/**
 * Protokoll jedes Support-Zugriffs auf Kundendaten.
 *
 * Ohne Eintrag gibt es keinen Einblick: Der Zugriff wird zuerst mit Grund
 * protokolliert, danach werden Daten geladen. Kundenorganisationen können
 * diese Einträge in ihrem eigenen Audit-Log sehen.
 */
export const supportAccessLog = pgTable(
  "support_access_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    userLabel: text("user_label").notNull(),
    /** Pflichtangabe: warum wurde zugegriffen? */
    reason: text("reason").notNull(),
    /** Welcher Bereich eingesehen wurde. */
    scope: text("scope").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("support_access_org_idx").on(t.organizationId, t.createdAt),
    index("support_access_user_idx").on(t.userId, t.createdAt),
  ],
);

/** Plattformweite Funktionsschalter. */
export const featureFlag = pgTable(
  "feature_flag",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    key: text("key").notNull().unique(),
    label: text("label").notNull(),
    description: text("description").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    /** Optional auf einzelne Organisationen begrenzt (leer = alle). */
    organizationIds: jsonb("organization_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("feature_flag_key_uidx").on(t.key)],
);
