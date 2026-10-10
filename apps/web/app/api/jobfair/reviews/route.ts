import { isBoothMember, myReviews, reviewBooth, reviewTotals } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { boothStands } from "@/lib/booths";
import { db } from "@/lib/db";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({ booth: z.string().regex(/^[\w-]{1,80}$/), stars: z.number().int().min(1).max(5) });

/** Every booth's star rating (counts only, never who wrote what), and this account's own stars. */
export async function GET() {
  const user = await currentUser();
  const [totals, mine] = await Promise.all([reviewTotals(db), user ? myReviews(db, user.id) : {}]);
  return NextResponse.json({ totals, mine }, { headers: { "Cache-Control": "no-store" } });
}

/** A signed-in job seeker reviews a booth; a new review replaces their earlier one. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`review:${user.id}`, 60, 3_600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  if (!(await boothStands(body.data.booth))) return fail(404, "not_found");
  // A company's own team can't rate its booth.
  if (await isBoothMember(db, user.id, body.data.booth)) return fail(403, "own_booth");
  const first = await reviewBooth(db, { userId: user.id, boothKey: body.data.booth, stars: body.data.stars });
  return NextResponse.json({ ok: true, first });
}
