import "server-only";
import { type PreregEventRow, type PreregRegistrationRow, preregFormData } from "@vwo/db";
import { type PreregData, type PublicPreregEvent, preregDate, preregState, safeImage } from "@vwo/shared";
import { envInt } from "./limits";
import { appUrl, mailEnabled, sendMail } from "./mail";
import { allow } from "./ratelimit";

/** Turnstile's public site key for pages outside the game; the game's build-time one works too. */
export const turnstileSiteKey = () => process.env.TURNSTILE_SITE_KEY || process.env.VITE_TURNSTILE_SITE_KEY || "";

/** The form asks for Turnstile only when both keys are set, so a missing site key can't lock everyone out. */
export const preregCaptchaOn = () => !!process.env.TURNSTILE_SECRET_KEY && !!turnstileSiteKey();

/** Refuse sign-ups while Turnstile is not set up, instead of falling back to the proof of work (PREREG_REQUIRE_CAPTCHA=1). */
export const preregRequireCaptcha = () => process.env.PREREG_REQUIRE_CAPTCHA === "1";

/**
 * The organiser is warned (a red banner) when the live site takes sign-ups without Turnstile: the
 * proof of work and the other checks still run, but Turnstile is the strongest one and costs nothing.
 */
export const preregCaptchaWarning = () => process.env.NODE_ENV === "production" && !preregCaptchaOn();

let warned = false;
/** Say so once in the server log too, the first time a form is shown on an instance. */
export function warnIfUnprotected() {
  if (warned || !preregCaptchaWarning()) return;
  warned = true;
  console.warn("[antibot] Turnstile is not set up: public sign-up forms rely on the proof of work. Set TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.");
}

/** The name of an event's form in its token and Turnstile's action for it. */
export const preregForm = (slug: string) => `prereg:${slug}`;
export const PREREG_ACTION = "prereg";

/**
 * Sign-ups to one event in 10 minutes before it goes into slow mode for half an hour: a harder proof
 * of work (Turnstile, when on, stays as it is) and a notice for the organiser.
 */
export const preregEventBurst = () => envInt("PREREG_EVENT_BURST", 300, 5, 1_000_000);
export const PREREG_SLOW_MS = 30 * 60_000;
export const preregSlowKey = (eventId: string) => `prereg:slow:${eventId}`;
/** Sign-ups per hour from one network (/24 or /64), on top of the per-address limit. */
export const preregRatePerNet = () => envInt("PREREG_RATE_PER_NET", 120, 1, 100_000);

/** Sign-ups and changes from one address per hour (a campus shares one), and lookups per 10 minutes. */
export const preregRatePerIp = () => envInt("PREREG_RATE_PER_IP", 30, 1, 10_000);
/** Confirmation emails per day for all sign-ups together: Resend's free plan sends 100 a day for everything. */
export const preregMailPerDay = () => envInt("PREREG_MAIL_PER_DAY", 60, 0, 100_000);

/** What anyone may see of an event: never anyone's sign-up. */
export function publicEvent(e: PreregEventRow, count: number, now = Date.now()): PublicPreregEvent {
  return {
    slug: e.slug,
    name: e.name,
    date: preregDate(e),
    location: e.location,
    about: e.about ?? "",
    banner: safeImage(e.banner) ?? null,
    state: preregState(e, count, now),
  };
}

/** One's own sign-up, as shown back to the person holding its email and code. */
export function ownRegistration(r: PreregRegistrationRow, e: PreregEventRow) {
  return { code: r.code, event: { slug: e.slug, name: e.name, date: preregDate(e), location: e.location }, data: preregFormData(r.data), at: r.createdAt.getTime() };
}

/**
 * The code by email, when email is set up and today's share of the free plan is not used up. A failed
 * or skipped email never fails the sign-up: the code is on screen already.
 */
export async function mailPreregCode(r: { email: string; code: string; data: unknown }, e: PreregEventRow, resent = false) {
  if (!mailEnabled() || preregMailPerDay() === 0) return false;
  if (!(await allow(`prereg-mail:${r.email}`, 3, 86_400_000))) return false;
  if (!(await allow("prereg-mail:day", preregMailPerDay(), 86_400_000))) return false;
  const name = ((r.data as Partial<PreregData>)?.fullName ?? "").slice(0, 80);
  const date = preregDate(e);
  const text = [
    `Halo ${name || "kamu"},`,
    "",
    resent ? `Ini kode pra-registrasi kamu untuk ${e.name}:` : `Pra-registrasi kamu untuk ${e.name} sudah kami terima.`,
    "",
    `Kode: ${r.code}`,
    date ? `Tanggal: ${date}` : "",
    `Tempat: ${e.location}`,
    "",
    `Saat acara dibuka, masuk di ${appUrl()} dengan akun Google ${r.email}. Data kamu sudah tersimpan, tidak perlu daftar ulang.`,
    `Mau mengubah data? Buka ${appUrl()}/daftar/${e.slug} lalu masukkan email dan kode ini.`,
    "",
    "Abaikan email ini kalau kamu tidak mendaftar.",
    "",
    "Salam,",
    "Panitia jobfair",
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n");
  try {
    await sendMail(r.email, `Kode pra-registrasi ${e.name}: ${r.code}`, text);
    return true;
  } catch {
    return false;
  }
}
