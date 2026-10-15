import { createPreregEvent, holdUntil, listPreregEvents } from "@vwo/db";
import { preregEventInput } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, readSizedBody, sameOrigin } from "@/lib/http";
import { preregCaptchaOn, preregCaptchaWarning, preregSlowKey } from "@/lib/prereg";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";
import { adminEvent } from "./view";

export const dynamic = "force-dynamic";

/**
 * Every pre-registration event with its sign-up count and slow mode, and whether the forms have
 * Turnstile (`warn`: the live site takes sign-ups without it): event admins only.
 */
export async function GET() {
  if (!isFairAdmin(await currentUser())) return fail(403, "not_allowed");
  const rows = await listPreregEvents(db);
  const events = await Promise.all(rows.map(async (r) => adminEvent(r.event, r.count, r.event.open ? await holdUntil(db, preregSlowKey(r.event.id)) : null)));
  const antibot = { turnstile: preregCaptchaOn(), warn: preregCaptchaWarning() && rows.some((r) => r.event.open) };
  return NextResponse.json({ events, antibot }, { headers: { "Cache-Control": "no-store" } });
}

/** The organiser makes an event with its own sign-up link, jobfair.co.id/daftar/<slug>. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!isFairAdmin(user)) return fail(403, "not_allowed");
  if (!(await allow(`prereg-event:${user!.id}`, 60, 3_600_000))) return fail(429, "too_many_requests");
  const body = await readSizedBody(req, preregEventInput, 320_000);
  if ("error" in body) return body.error;
  const row = await createPreregEvent(db, body.data, user!.id);
  return NextResponse.json({ event: adminEvent(row, 0) }, { status: 201 });
}
