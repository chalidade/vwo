import { NextResponse } from "next/server";
import { z } from "zod";
import { moveStand } from "@/lib/booths";
import { isFairAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const BOOTH = /^[\w-]{1,80}$/;
const schema = z.object({ floor: z.number().int().min(0).max(20), slot: z.number().int().min(0).max(5) });

/**
 * The organiser moves a stand to another slot, on its floor or another booth floor; onto a stand
 * that is there, the two swap places. Event admins only. Everyone's game picks the new places up
 * from the event setup (see state/route.ts), and the booth's applicants, promoter, media and the
 * floor's entry price go with the booth, since they follow its id and floor.
 */
export async function POST(req: Request, { params }: { params: Promise<{ booth: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!isFairAdmin(user)) return fail(403, "not_allowed");
  const { booth } = await params;
  if (!BOOTH.test(booth)) return fail(404, "not_found");
  if (!(await allow(`stand-move:${user.id}`, 60, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const r = await moveStand(booth, body.data, user.id);
  if ("error" in r) return fail(r.error === "not_found" ? 404 : r.error === "same_slot" ? 409 : 400, r.error);
  return NextResponse.json({ ok: true, placements: r.placements, swapped: r.swapped });
}
