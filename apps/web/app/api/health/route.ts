import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Uptime check: is the database reachable and how many migrations have run. Reveals nothing else. */
export async function GET() {
  try {
    const rows = await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    return NextResponse.json({ ok: true, db: true, migrations: Number(rows[0]?.n ?? 0) });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 503 });
  }
}
