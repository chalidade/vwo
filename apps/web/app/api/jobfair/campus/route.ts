import { campusBoard } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Read on request and kept by the CDN, never prerendered: a build must not need the database.
export const dynamic = "force-dynamic";

/** Campuses ranked by their students' XP at the fair: names and sums only, the same for everyone. */
export async function GET() {
  const top = await campusBoard(db, 20);
  return NextResponse.json({ top }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
