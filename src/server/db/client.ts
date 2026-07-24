import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Zwei Verbindungs-Pools:
 * - appPool: Nicht-Superuser-Rolle `workforce_app`, unterliegt Row Level Security.
 *   Alle mandantenbezogenen Zugriffe laufen über `withOrg()` in einer Transaktion
 *   mit `SET LOCAL app.org_id`, die RLS-Policies auswerten.
 * - adminPool: Owner-Rolle für Migrationen, Auth-Tabellen (Better Auth) und
 *   organisationsübergreifende Systemjobs. Nie für nutzergesteuerte Queries.
 */
declare global {
  var __wfPools:
    | { appPool: Pool; adminPool: Pool }
    | undefined;
}

function createPools() {
  const appPool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
  const adminPool = new Pool({
    connectionString: env.DATABASE_ADMIN_URL,
    max: 10,
  });
  return { appPool, adminPool };
}

const pools = globalThis.__wfPools ?? createPools();
if (env.NODE_ENV !== "production") globalThis.__wfPools = pools;

export const { appPool, adminPool } = pools;

export type Database = NodePgDatabase<typeof schema>;

/** RLS-unterworfene DB (nur innerhalb von withOrg verwenden). */
export const db: Database = drizzle(appPool, { schema });

/** DB mit Owner-Rechten – ausschließlich für Migrationen, Auth und Systemjobs. */
export const adminDb: Database = drizzle(adminPool, { schema });

/**
 * Führt `fn` in einer Transaktion aus, in der die RLS-Policies auf die
 * angegebene Organisation gescoped sind. Alle mandantenbezogenen Queries
 * MÜSSEN durch diese Funktion laufen (Defense in Depth: zusätzlich filtern
 * Repositories explizit nach organizationId).
 */
export async function withOrg<T>(
  organizationId: string,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  if (!organizationId) throw new Error("withOrg: organizationId fehlt");
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.org_id', ${organizationId}, true)`,
    );
    return fn(tx as unknown as Database);
  });
}
