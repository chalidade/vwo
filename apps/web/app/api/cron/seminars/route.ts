import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { fail } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { orgSeminars, sendSeminarPushes } from "@/lib/seminars";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * "15 minutes to go" and "starting now" pushes for registered seekers. Visitors' setup reads already
 * trigger them (see lib/seminars.ts); a scheduler calling this every 5 minutes with CRON_SECRET makes
 * them on time even when nobody is in the game. Each push goes out once, however often this runs.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return fail(401, "unauthorized");
  if (!(await allow("cron:seminars", 30, 3_600_000))) return fail(429, "too_many_requests");
  const sent = await sendSeminarPushes(await orgSeminars(), Date.now());
  return NextResponse.json({ ok: true, sent });
}
