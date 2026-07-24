import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

/**
 * Führt alle ausstehenden Migrationen mit der Owner-Rolle aus.
 * Aufruf: pnpm db:migrate  (DATABASE_ADMIN_URL steuert die Ziel-DB)
 */
async function main() {
  const url =
    process.env.DATABASE_ADMIN_URL ??
    "postgres://workforce_owner:workforce_owner_dev@localhost:5432/workforce_dev";
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);
  console.log(`Migrationen ausführen auf ${url.replace(/:[^:@/]+@/, ":***@")}`);
  await migrate(db, { migrationsFolder: "./src/server/db/migrations" });
  await pool.end();
  console.log("Migrationen abgeschlossen.");
}

main().catch((err) => {
  console.error("Migration fehlgeschlagen:", err);
  process.exit(1);
});
