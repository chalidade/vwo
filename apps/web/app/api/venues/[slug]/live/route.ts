import { getLiveSnapshot, getVenueBySlug } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { venuePagesOn } from "@/lib/venues";

export const dynamic = "force-dynamic";

// Staff live view. TODO(auth): restrict to venue_members once login lands.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!venuePagesOn()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { slug } = await params;
  const venue = await getVenueBySlug(db, slug);
  if (!venue) return NextResponse.json({ error: "venue_not_found" }, { status: 404 });
  return NextResponse.json(await getLiveSnapshot(db, venue.id));
}
