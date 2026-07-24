/**
 * Zentrales Drizzle-Schema. Die Domänen-Schemas werden hier re-exportiert.
 * Jede mandantenbezogene Tabelle trägt `organization_id` + RLS-Policy
 * (siehe Migrationen unter src/server/db/migrations).
 */
export * from "./meta";
export * from "./auth";
export * from "./core";
