import { holdUntil, preregByEmail, preregEventBySlug, setHold, submitPrereg } from "@vwo/db";
import { emailKey, ipBucket, isDisposableEmail, isIndonesianMobile, isPreregSlug, junkText, normalizePreregCode, plausibleEmail, preregRequest } from "@vwo/shared";
import { NextResponse } from "next/server";
import { VERIFY_FAILED, guardForm, issueFormToken, logRefused, powBits, powSlowBits, saltedHash } from "@/lib/antibot";
import { db } from "@/lib/db";
import { clientIp, fail, readSizedBody, sameOrigin } from "@/lib/http";
import {
  PREREG_ACTION,
  PREREG_SLOW_MS,
  mailPreregCode,
  ownRegistration,
  preregCaptchaOn,
  preregEventBurst,
  preregForm,
  preregRatePerIp,
  preregRatePerNet,
  preregRequireCaptcha,
  preregSlowKey,
} from "@/lib/prereg";
import { allow } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * A job seeker signs up for an event (no account needed), or changes their sign-up with its code. The
 * answer carries only what they sent and their code. Sending an email that already signed up, without
 * its code, changes nothing: the code is emailed to that address again instead (when email is on).
 *
 * Against scripts (lib/antibot.ts): the page's signed token, Turnstile or else a proof of work, limits
 * per address, per network and per inbox, odd text refused, and an event flooded with sign-ups goes
 * into slow mode. Every answer after the checks carries a fresh token (`form`) for the next try.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const { slug } = await params;
  if (!isPreregSlug(slug)) return fail(404, "not_found");
  const ip = clientIp(req);
  if (!(await allow(`prereg:ip:${ip}`, preregRatePerIp(), 3_600_000))) return fail(429, "too_many_requests");
  if (!(await allow(`prereg:net:${ipBucket(ip)}`, preregRatePerNet(), 3_600_000))) return fail(429, "too_many_requests");
  const body = await readSizedBody(req, preregRequest, 8_000);
  if ("error" in body) return body.error;
  const found = await preregEventBySlug(db, slug);
  if (!found) return fail(404, "not_found");
  const { event } = found;

  const form = preregForm(slug);
  const captchaOn = preregCaptchaOn();
  const slow = !!(await holdUntil(db, preregSlowKey(event.id)));
  const bits = captchaOn ? 0 : slow ? powSlowBits() : powBits();
  const next = { form: issueFormToken(form, bits) };
  const refuse = (reason: string) => (logRefused(form, reason, { slow: slow ? 1 : 0 }), fail(400, VERIFY_FAILED, next));
  const guard = await guardForm(req, {
    form,
    token: body.data.form,
    pow: body.data.pow,
    captcha: body.data.captcha,
    honeypot: body.data.website2,
    action: PREREG_ACTION,
    captchaOn,
    captchaRequired: preregRequireCaptcha(),
    minBits: bits,
  });
  if (!guard.ok) return refuse(guard.reason);
  // Too many sign-ups to this event at once: slow mode for a while. Without Turnstile this sending is
  // asked again with the harder proof of work its fresh token now carries.
  if (!(await allow(`prereg:burst:${event.id}`, preregEventBurst(), 600_000))) {
    await setHold(db, preregSlowKey(event.id), PREREG_SLOW_MS);
    if (!slow && !captchaOn) return fail(400, VERIFY_FAILED, { form: issueFormToken(form, powSlowBits()) });
  }

  const d = body.data.data;
  if (!plausibleEmail(d.email) || isDisposableEmail(d.email)) return fail(400, "email_rejected", next);
  if (!isIndonesianMobile(d.whatsapp)) return fail(400, "invalid_input", { fields: { whatsapp: ["invalid_phone"] }, ...next });
  const junk = junkText({ fullName: d.fullName, city: d.city }, { institution: d.institution, major: d.major, skills: d.skills, experience: d.experience });
  if (junk.length) return refuse(`junk:${junk.join(",")}`);
  const email = d.email;
  const inbox = saltedHash("inbox", emailKey(email));
  // One inbox written a hundred ways (s.a.r.i+1@gmail.com…) counts as one.
  if (!(await allow(`prereg:inbox:${inbox}`, 20, 86_400_000))) return fail(429, "too_many_requests", next);
  // One address trying codes against one sign-up is held back long before the code could be guessed.
  if (!(await allow(`prereg:email:${event.id}:${email}`, 10, 3_600_000))) return fail(429, "too_many_requests", next);
  const code = body.data.code ? normalizePreregCode(body.data.code) : null;
  const out = await submitPrereg(db, { eventId: event.id, data: d, code, signals: { ib: saltedHash("net", guard.bucket), ek: inbox, ft: guard.fillSec } });
  if (out.status === "no_event") return fail(404, "not_found");
  // The same Gmail inbox signed up already under another spelling: the code goes to that spelling.
  if (out.status === "same_inbox") return fail(409, "already_registered", { resent: await mailPreregCode(out.registration, event, true), ...next });
  if (out.status === "exists") {
    const mine = await preregByEmail(db, event.id, email);
    const resent = mine && !body.data.code ? await mailPreregCode(mine, event, true) : false;
    return fail(409, body.data.code ? "wrong_code" : "already_registered", { resent, ...next });
  }
  if (out.status !== "created" && out.status !== "updated") return fail(409, out.status, next);
  const mailed = out.status === "created" ? await mailPreregCode(out.registration, event) : false;
  return NextResponse.json({ status: out.status, mailed, registration: ownRegistration(out.registration, event), ...next }, { status: out.status === "created" ? 201 : 200 });
}
