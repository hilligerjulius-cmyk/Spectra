import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Systemweite Metadaten (kein Mandantenbezug), z. B. Health-Check und
 * Plattform-Konfigurationswerte.
 */
export const systemMeta = pgTable("system_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
