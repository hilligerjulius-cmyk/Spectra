import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/**
 * Benachrichtigungseinstellungen je Person und Organisation.
 *
 * Standard ist bewusst zurückhaltend: In-App immer, E-Mail nur für Vorgänge,
 * die eine Entscheidung oder ein Eingreifen erfordern. Ohne konfigurierten
 * SMTP-Zugang landen E-Mails nachvollziehbar in der Outbox — es wird nichts
 * unbemerkt versendet.
 */
export const notificationPreference = pgTable(
  "notification_preference",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Benachrichtigungstypen, für die In-App-Meldungen erscheinen. */
    inAppTypes: jsonb("in_app_types").$type<string[]>().notNull().default([]),
    /** Benachrichtigungstypen, die zusätzlich per E-Mail gehen. */
    emailTypes: jsonb("email_types").$type<string[]>().notNull().default([]),
    /** Tageszusammenfassung statt Einzelmeldungen per E-Mail. */
    dailyDigest: boolean("daily_digest").notNull().default(false),
    /** Uhrzeit der Tageszusammenfassung im Format HH:MM (lokale Zeit der Org). */
    digestHour: text("digest_hour").notNull().default("08:00"),
    /** Zeitpunkt der letzten versendeten Zusammenfassung (Doppelversand-Schutz). */
    lastDigestAt: timestamp("last_digest_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("notification_preference_uidx").on(t.organizationId, t.userId),
  ],
);
