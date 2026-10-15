import { holdUntil, preregEventBySlug } from "@vwo/db";
import { REGIONS, isPreregSlug } from "@vwo/shared";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { issueFormToken, powBits, powSlowBits } from "@/lib/antibot";
import { preregCaptchaOn, preregForm, warnIfUnprotected, preregRequireCaptcha, preregSlowKey, publicEvent, turnstileSiteKey } from "@/lib/prereg";
import { PreregForm } from "../PreregForm";
import "../../soon.css";
import "../daftar.css";

export const dynamic = "force-dynamic";

const load = async (slug: string) => (isPreregSlug(slug) ? preregEventBySlug(db, slug) : null);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const found = await load((await params).slug);
  return { title: found ? `Daftar ${found.event.name} · jobfair` : "Pendaftaran · jobfair" };
}

const STATE_NOTE = {
  closed: "Pendaftaran event ini sedang ditutup panitia.",
  deadline: "Batas waktu pendaftaran event ini sudah lewat.",
  full: "Kuota pendaftaran event ini sudah penuh.",
} as const;

/** jobfair.co.id/daftar/<slug>: a job seeker signs up for one event before it opens and keeps the code. */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const found = await load((await params).slug);
  if (!found) notFound();
  const e = publicEvent(found.event, found.count);
  const cities = REGIONS.flatMap(([, list]) => list);
  const captcha = preregCaptchaOn();
  warnIfUnprotected();
  // The form's signed token; without Turnstile it also asks the browser for a proof of work, harder in slow mode.
  const bits = captcha ? 0 : (await holdUntil(db, preregSlowKey(found.event.id))) ? powSlowBits() : powBits();
  const token = issueFormToken(preregForm(e.slug), bits);
  const paused = preregRequireCaptcha() && !captcha;
  return (
    <div className="cs">
      <div className="cs-glow a" />
      <div className="cs-glow b" />
      <div className="rg pr">
        <header className="cs-top">
          <a href="/">
            <img className="cs-logo" src="/brand/jobfair-logo.png" alt="jobfair.co.id" width={74} height={79} />
          </a>
          <span className="cs-pill">Pra-registrasi pelamar</span>
        </header>
        {e.banner && <img className="pr-banner" src={e.banner} alt="" />}
        <h1 className="cs-h1" style={{ fontSize: "clamp(30px, 5vw, 46px)", marginTop: 26 }}>
          {e.name}
        </h1>
        <p className="pr-meta">
          {e.date && <span>{e.date}</span>}
          <span>{e.location}</span>
        </p>
        {e.about && (
          <p className="cs-sub" style={{ margin: "12px 0 0" }}>
            {e.about}
          </p>
        )}
        <ol className="rg-steps">
          <li>Isi data diri</li>
          <li>Simpan kode</li>
          <li>Saat acara dibuka, masuk dengan Google</li>
        </ol>
        {e.state !== "open" && (
          <p className="cs-note" style={{ marginTop: 18 }}>
            {STATE_NOTE[e.state]} Sudah mendaftar? Kamu tetap bisa melihat kodemu di bawah.
          </p>
        )}
        {paused && e.state === "open" && (
          <p className="cs-note" style={{ marginTop: 18 }}>
            Formulir pendaftaran sedang disiapkan panitia. Coba lagi beberapa saat lagi. Sudah mendaftar? Kamu tetap bisa melihat kodemu di bawah.
          </p>
        )}
        <PreregForm event={paused ? { ...e, state: "closed" } : e} siteKey={captcha ? turnstileSiteKey() : ""} cities={cities} formToken={token} />
      </div>
    </div>
  );
}
