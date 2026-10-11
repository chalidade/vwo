import { closedEvents, freezeBoothReports, ReportNameTakenError, reportBoothKeys } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { standingBoothIds } from "@/lib/booths";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({ eventName: z.string().trim().min(3).max(80) });

/** Events the organiser already closed, with how many booth reports each saved. Organisers only. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!isFairAdmin(user)) return fail(403, "not_allowed");
  const events = await closedEvents(db);
  return NextResponse.json({ events: events.map((e) => ({ eventName: e.eventName, booths: e.booths, at: e.at.getTime() })) }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Close the event: every booth's report is frozen under the event's name, so each company can
 * compare its next event with this one. Organisers only; a name can be used once.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!isFairAdmin(user)) return fail(403, "not_allowed");
  if (!(await allow(`freeze-reports:${user.id}`, 5, 3_600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const boothKeys = [...new Set([...(await standingBoothIds()), ...(await reportBoothKeys(db))])];
  try {
    const saved = await freezeBoothReports(db, { eventName: body.data.eventName, boothKeys, by: user.id });
    return NextResponse.json({ saved }, { status: 201 });
  } catch (e) {
    if (e instanceof ReportNameTakenError) return fail(409, "name_taken");
    throw e;
  }
}
