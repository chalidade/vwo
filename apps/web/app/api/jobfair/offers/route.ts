import { dropSeekerOffer, seekerOffers } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in seeker's invitations to apply ("Tawaran perusahaan"), newest first. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  return NextResponse.json({ offers: await seekerOffers(db, user.id) }, { headers: { "Cache-Control": "no-store" } });
}

/** The seeker dismisses an offer, or it is cleared once they applied. */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return fail(400, "invalid_input");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`offers:${user.id}`, 120, 600_000))) return fail(429, "too_many_requests");
  return (await dropSeekerOffer(db, user.id, id)) ? NextResponse.json({ ok: true }) : fail(404, "not_found");
}
