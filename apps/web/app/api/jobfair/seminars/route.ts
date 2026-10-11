import { mySeminarRegs, seminarRegCounts, setSeminarRegistration } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { orgSeminars } from "@/lib/seminars";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({ seminarId: z.string().regex(/^[\w-]{1,80}$/), register: z.boolean() });

/** How many registered for each session (counts only, never who), and the sessions this account registered for. */
export async function GET() {
  const user = await currentUser();
  const [counts, mine] = await Promise.all([seminarRegCounts(db), user ? mySeminarRegs(db, user.id) : []]);
  return NextResponse.json({ counts, mine }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * A signed-in seeker registers for a session ("Daftar") or cancels ("Batal"). The session, its time and
 * its seats come from the organiser's setup on the server, never from the request; a full or finished
 * session refuses new registrations.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`semreg:${user.id}`, 30, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const slot = (await orgSeminars()).find((s) => s.id === body.data.seminarId);
  if (!slot) return fail(404, "not_found");
  const r = await setSeminarRegistration(db, { slot, userId: user.id, register: body.data.register, now: Date.now() });
  if (!r.ok) return fail(409, r.error, { count: r.count });
  return NextResponse.json(r);
}
