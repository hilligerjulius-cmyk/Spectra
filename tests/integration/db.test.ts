import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

describe("Datenbank-Fundament", () => {
  it("verbindet sich mit der Test-DB und findet migrierte Tabellen", async () => {
    const { adminDb } = await import("@/server/db/client");
    const res = await adminDb.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public' and table_name = 'system_meta'`,
    );
    expect(res.rows).toHaveLength(1);
  });

  it("hat pgvector und pgcrypto installiert", async () => {
    const { adminDb } = await import("@/server/db/client");
    const res = await adminDb.execute(
      sql`select extname from pg_extension where extname in ('vector', 'pgcrypto') order by extname`,
    );
    expect(res.rows.map((r) => r.extname)).toEqual(["pgcrypto", "vector"]);
  });
});
