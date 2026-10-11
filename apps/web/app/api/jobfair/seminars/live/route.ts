import { NextResponse } from "next/server";
import { z } from "zod";
import { isFairAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { announceSeminarStart, orgSeminars } from "@/lib/seminars";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({ seminarId: z.string().regex(/^[\w-]{1,80}$/) });

/** The speaker page went live with a session: a push to everyone registered that it is starting (once per session). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!isFairAdmin(user)) return fail(403, "not_allowed");
  if (!(await allow(`semlive:${user.id}`, 20, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const slot = (await orgSeminars()).find((s) => s.id === body.data.seminarId);
  if (!slot) return fail(404, "not_found");
  const sent = await announceSeminarStart(slot, Date.now());
  return NextResponse.json({ ok: true, sent });
}
