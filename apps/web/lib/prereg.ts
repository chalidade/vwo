import "server-only";
import type { PreregEventRow, PreregRegistrationRow } from "@vwo/db";
import { type PreregData, type PublicPreregEvent, preregDate, preregState, safeImage } from "@vwo/shared";
import { envInt } from "./limits";
import { appUrl, mailEnabled, sendMail } from "./mail";
import { allow } from "./ratelimit";

/** Turnstile's public site key for pages outside the game; the game's build-time one works too. */
export const turnstileSiteKey = () => process.env.TURNSTILE_SITE_KEY || process.env.VITE_TURNSTILE_SITE_KEY || "";

/** The form asks for Turnstile only when both keys are set, so a missing site key can't lock everyone out. */
export const preregCaptchaOn = () => !!process.env.TURNSTILE_SECRET_KEY && !!turnstileSiteKey();

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
  return { code: r.code, event: { slug: e.slug, name: e.name, date: preregDate(e), location: e.location }, data: r.data as PreregData, at: r.createdAt.getTime() };
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
