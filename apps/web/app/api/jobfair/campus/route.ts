import { campusBoard } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const revalidate = 300;

/** Campuses ranked by their students' XP at the fair: names and sums only, the same for everyone. */
export async function GET() {
  const top = await campusBoard(db, 20);
  return NextResponse.json({ top }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
