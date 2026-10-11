import { seminarRegistrants } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const ID = /^[\w-]{1,80}$/;

/** Who registered for one session (name, email, when), for the organiser's export. Event admins only. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!isFairAdmin(user)) return fail(403, "not_allowed");
  if (!(await allow(`semexport:${user.id}`, 30, 600_000))) return fail(429, "too_many_requests");
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!ID.test(id)) return fail(400, "invalid_input");
  const registrants = await seminarRegistrants(db, id);
  return NextResponse.json({ registrants }, { headers: { "Cache-Control": "no-store" } });
}
