import { preregByEmail, preregEventBySlug, submitPrereg } from "@vwo/db";
import { isPreregSlug, normalizePreregCode, preregRequest } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp, fail, readSizedBody, sameOrigin } from "@/lib/http";
import { mailPreregCode, ownRegistration, preregCaptchaOn, preregRatePerIp } from "@/lib/prereg";
import { allow } from "@/lib/ratelimit";
import { isHuman } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

/**
 * A job seeker signs up for an event (no account needed), or changes their sign-up with its code. The
 * answer carries only what they sent and their code. Sending an email that already signed up, without
 * its code, changes nothing: the code is emailed to that address again instead (when email is on).
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const { slug } = await params;
  if (!isPreregSlug(slug)) return fail(404, "not_found");
  const ip = clientIp(req);
  if (!(await allow(`prereg:ip:${ip}`, preregRatePerIp(), 3_600_000))) return fail(429, "too_many_requests");
  const body = await readSizedBody(req, preregRequest, 8_000);
  if ("error" in body) return body.error;
  if (body.data.website2) return fail(400, "not_human");
  if (preregCaptchaOn() && !(await isHuman(body.data.captcha, ip))) return fail(400, "not_human");
  const found = await preregEventBySlug(db, slug);
  if (!found) return fail(404, "not_found");
  const { event } = found;
  const email = body.data.data.email;
  // One address trying codes against one sign-up is held back long before the code could be guessed.
  if (!(await allow(`prereg:email:${event.id}:${email}`, 10, 3_600_000))) return fail(429, "too_many_requests");
  const code = body.data.code ? normalizePreregCode(body.data.code) : null;
  const out = await submitPrereg(db, { eventId: event.id, data: body.data.data, code });
  if (out.status === "no_event") return fail(404, "not_found");
  if (out.status === "exists") {
    const mine = await preregByEmail(db, event.id, email);
    const resent = mine && !body.data.code ? await mailPreregCode(mine, event, true) : false;
    return fail(409, body.data.code ? "wrong_code" : "already_registered", { resent });
  }
  if (out.status !== "created" && out.status !== "updated") return fail(409, out.status);
  const mailed = out.status === "created" ? await mailPreregCode(out.registration, event) : false;
  return NextResponse.json({ status: out.status, mailed, registration: ownRegistration(out.registration, event) }, { status: out.status === "created" ? 201 : 200 });
}
