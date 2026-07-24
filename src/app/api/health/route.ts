import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { adminDb } from "@/server/db/client";

export const dynamic = "force-dynamic";

/** Health-Check: App erreichbar + Datenbankverbindung funktioniert. */
export async function GET() {
  try {
    await adminDb.execute(sql`select 1`);
    return NextResponse.json({ status: "ok", database: "ok" });
  } catch {
    return NextResponse.json(
      { status: "degraded", database: "unreachable" },
      { status: 503 },
    );
  }
}
