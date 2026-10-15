import "server-only";
import { botUserAgent, ipBucket, isDisposableEmail, junkText, leadingZeroBits } from "@vwo/shared";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { clientIp, fail } from "./http";
import { envInt } from "./limits";
import { allow } from "./ratelimit";
import { verifyTurnstile } from "./turnstile";

// Layers against scripted sign-ups on the public forms, all free and without a third party except
// Turnstile when its keys are set:
//  - a signed form token from the page: no token, someone else's form, sent within seconds of opening
//    the page or hours later, or a token used before, all fail;
//  - Turnstile when on, otherwise a small proof of work in the browser bound to that token;
//  - the honeypot field and a browser User-Agent.
// Each failure answers the same "verify_failed" so a script learns nothing; the reason goes to the log.

/** Sent faster than this after the page opened: no person reads and fills a form that fast. */
export const FORM_MIN_MS = 3_000;
/** A page open longer than this gets a new token on the next try (the answer carries one). */
export const FORM_MAX_MS = 2 * 3_600_000;

/** Proof-of-work bits when Turnstile is off (about 2^bits hashes in the browser), and in slow mode. */
export const powBits = () => envInt("PREREG_POW_BITS", 13, 0, 22);
export const powSlowBits = () => Math.max(powBits(), envInt("PREREG_POW_SLOW_BITS", 16, 0, 24));

const secret = () => process.env.PREVIEW_SECRET || process.env.DATABASE_URL || "";
const mac = (purpose: string, value: string) => createHmac("sha256", `vwo-antibot:${purpose}:${secret()}`).update(value).digest("base64url");

/** A short salted hash: the same input gives the same value here, and nothing outside can reverse it. */
export const saltedHash = (purpose: string, value: string) => mac(purpose, value).slice(0, 16);

/**
 * A token for one form, given with the page: when it was issued, the proof-of-work bits asked for,
 * a random part and the form's name, signed. "v1.<issued>.<bits>.<random>.<form>.<signature>".
 */
export function issueFormToken(form: string, bits: number, now = Date.now()) {
  const body = `v1.${now}.${bits}.${randomBytes(9).toString("base64url")}.${form}`;
  return `${body}.${mac("form", body)}`;
}

export type FormToken = { issued: number; bits: number; nonce: string };

export function readFormToken(token: string | undefined, form: string, now = Date.now()): { ok: true; token: FormToken } | { ok: false; reason: string } {
  if (!token || token.length > 300) return { ok: false, reason: "token_missing" };
  const i = token.lastIndexOf(".");
  const body = token.slice(0, i);
  const parts = body.split(".");
  if (i < 0 || parts.length !== 5 || parts[0] !== "v1") return { ok: false, reason: "token_bad" };
  const want = Buffer.from(mac("form", body));
  const got = Buffer.from(token.slice(i + 1));
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, reason: "token_bad" };
  if (parts[4] !== form) return { ok: false, reason: "token_form" };
  const issued = Number(parts[1]);
  const bits = Number(parts[2]);
  if (!Number.isFinite(issued) || !Number.isInteger(bits)) return { ok: false, reason: "token_bad" };
  if (now - issued < FORM_MIN_MS) return { ok: false, reason: "too_fast" };
  if (now - issued > FORM_MAX_MS) return { ok: false, reason: "token_old" };
  return { ok: true, token: { issued, bits, nonce: parts[3]! } };
}

/** The proof of work: SHA-256 of "<token>:<answer>" starts with the token's bits of zeros. One hash to check. */
export function validPow(token: string, answer: string | undefined, bits: number) {
  if (bits <= 0) return true;
  if (!answer || !/^\d{1,9}$/.test(answer)) return false;
  return leadingZeroBits(createHash("sha256").update(`${token}:${answer}`).digest()) >= bits;
}

export interface GuardInput {
  /** The form's name in its token, e.g. "prereg:job-fair-bandung". */
  form: string;
  token?: string;
  pow?: string;
  captcha?: string;
  /** The hidden field people leave empty. */
  honeypot?: string;
  /** Turnstile's action for this form. */
  action: string;
  /** Turnstile is set up and the form shows it. */
  captchaOn: boolean;
  /** Refuse when Turnstile is not set up (PREREG_REQUIRE_CAPTCHA=1). */
  captchaRequired?: boolean;
  /** Least proof-of-work bits accepted now (more in slow mode). */
  minBits?: number;
}

export type Guard = { ok: true; ip: string; bucket: string; fillSec: number } | { ok: false; reason: string; ip: string };

/** Every check of a form token, Turnstile or proof of work, honeypot and User-Agent, cheapest first. */
export async function guardForm(req: Request, g: GuardInput, now = Date.now()): Promise<Guard> {
  const ip = clientIp(req);
  const no = (reason: string): Guard => ({ ok: false, reason, ip });
  if (g.honeypot) return no("honeypot");
  if (botUserAgent(req.headers.get("user-agent"))) return no("user_agent");
  if (g.captchaRequired && !g.captchaOn) return no("captcha_not_set_up");
  const t = readFormToken(g.token, g.form, now);
  if (!t.ok) return no(t.reason);
  if (g.captchaOn) {
    // Checked before the token is spent, so a slow Turnstile answer can be tried again with it.
    const human = await verifyTurnstile(g.captcha, ip, { action: g.action, host: req.headers.get("x-forwarded-host") ?? req.headers.get("host") }, now);
    if (!human.ok) return no(human.reason);
  } else {
    if (t.token.bits < (g.minBits ?? 0)) return no("pow_weak");
    if (!validPow(g.token!, g.pow, t.token.bits)) return no("pow");
  }
  // Each token works once: a script can't send one page's token a thousand times.
  if (!(await allow(`antibot:token:${t.token.nonce}`, 1, FORM_MAX_MS + 60_000))) return no("token_reused");
  return { ok: true, ip, bucket: ipBucket(ip), fillSec: Math.round((now - t.token.issued) / 1000) };
}

/** Write why a sending was refused, for the organiser's logs: the form and the reason, no personal data. */
export function logRefused(form: string, reason: string, extra: Record<string, string | number> = {}) {
  console.warn("[antibot] refused", JSON.stringify({ form: form.split(":")[0], reason, ...extra }));
}

/** The answer every refused check gets: nothing says which one. A fresh token comes with it. */
export const VERIFY_FAILED = "verify_failed";

/**
 * The checks for forms that need a sign-in first (company booth requests, account sign-up), which
 * carry no form token: a browser sent it, no more than `perNet` a day from one network, the email is
 * not a throwaway inbox, and the text is what a person types. Null when it passes; else the answer.
 */
export async function screenForm(
  req: Request,
  form: string,
  input: { email?: string; names: Record<string, string | undefined>; others?: Record<string, string | undefined> },
  perNet = 30,
) {
  const ip = clientIp(req);
  if (botUserAgent(req.headers.get("user-agent"))) return (logRefused(form, "user_agent"), fail(400, VERIFY_FAILED));
  if (!(await allow(`${form}:net:${ipBucket(ip)}`, perNet, 86_400_000))) return fail(429, "too_many_requests");
  if (input.email && isDisposableEmail(input.email)) return fail(400, "email_rejected");
  const junk = junkText(input.names, input.others);
  if (junk.length) return (logRefused(form, `junk:${junk.join(",")}`), fail(400, VERIFY_FAILED));
  return null;
}
