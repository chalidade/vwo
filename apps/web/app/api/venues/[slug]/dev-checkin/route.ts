// Development-only shortcut: creates a guest user and checks them in, standing in for the
// QR scan until the rotating-token check-in flow is built. Disabled in production.
import { randomUUID } from "node:crypto";
import { checkIn, getVenueBySlug, schema } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_CHECKIN !== "1") {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  const { slug } = await params;
  const venue = await getVenueBySlug(db, slug);
  if (!venue) return NextResponse.json({ error: "venue_not_found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { name?: string; companions?: number };
  const name = (body.name ?? "").trim().slice(0, 32) || "Tamu";
  const companionCount = Math.min(Math.max(Number(body.companions) || 0, 0), 9);

  const [user] = await db
    .insert(schema.users)
    .values({ email: `guest-${randomUUID()}@guest.local`, displayName: name })
    .returning();
  await db.insert(schema.profiles).values({ userId: user!.id, nickname: name });
  const result = await checkIn(db, {
    venueId: venue.id,
    userId: user!.id,
    hostName: name,
    method: "qr_entrance",
    companions: Array.from({ length: companionCount }, (_, i) => `${name} +${i + 1}`),
  });
  return NextResponse.json({
    visitId: result.visit.id,
    memberId: result.host.id,
    groupCode: result.visit.groupCode,
    companionIds: result.companions.map((c) => c.id),
  });
}
