import { leadsOf, myRegistrations } from "@vwo/db";
import { db } from "@/lib/db";
import { googleEnabled } from "@/lib/google";
import { currentUser } from "@/lib/session";
import { InquiryForm, type LeadView, type RegistrationView } from "./InquiryForm";
import "../soon.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daftar booth perusahaan · jobfair" };

/** The company registration link: sign in with Google, fill in the form, and the organiser calls back. No prices, no payment. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const user = await currentUser();
  const mine: RegistrationView[] = user
    ? (await myRegistrations(db, user.id)).map((r) => ({
        id: r.id,
        company: r.company,
        status: r.status,
        boothKey: r.status === "verified" ? r.boothKey : null,
        pin: r.status === "verified" ? r.pin : null,
        note: r.note,
        createdAt: r.createdAt.getTime(),
      }))
    : [];
  // A request the organiser fulfilled shows up as a verified registration (with its code and PIN) instead.
  const leads: LeadView[] = user
    ? (await leadsOf(db, user.id)).filter((l) => l.kind === "booth" && l.status !== "done").map((l) => ({ id: l.id, name: l.name, status: l.status, at: l.at }))
    : [];
  return (
    <div className="cs">
      <div className="cs-glow a" />
      <div className="cs-glow b" />
      <div className="rg">
        <header className="cs-top">
          <a href="/">
            <img className="cs-logo" src="/brand/jobfair-logo.png" alt="jobfair.co.id" width={74} height={79} />
          </a>
          <span className="cs-pill">Registrasi perusahaan</span>
        </header>
        <h1 className="cs-h1" style={{ fontSize: "clamp(30px, 5vw, 46px)", marginTop: 26 }}>
          Buka booth di <span className="cs-shine">jobfair</span>
        </h1>
        <p className="cs-sub" style={{ margin: "12px 0 0" }}>
          Isi data perusahaan dan kontak PIC. Panitia akan menghubungi kamu untuk membicarakan paket dan tempat stand, lalu membuatkan booth dan mengirim kode serta PIN untuk masuk
          ke portal perusahaan.
        </p>
        <ol className="rg-steps">
          <li>Masuk dengan Google</li>
          <li>Isi formulir</li>
          <li>Panitia menghubungi</li>
          <li>Terima kode & PIN</li>
        </ol>
        {user ? (
          <InquiryForm email={user.email} name={user.name} registrations={mine} initial={leads} />
        ) : (
          <div className="rg-card">
            <h2>Masuk dulu</h2>
            <p className="cs-sub" style={{ margin: "6px 0 16px", fontSize: 15 }}>
              Pakai akun Google kantor (email HR). Akun ini yang nanti mengelola booth perusahaanmu.
            </p>
            {q.login && <p className="rg-err">Masuk dengan Google gagal. Coba lagi.</p>}
            {googleEnabled() ? (
              <a className="cs-btn primary" href="/api/auth/google/start?to=register">
                Masuk dengan Google
              </a>
            ) : (
              <p className="rg-err">Login sedang disiapkan panitia. Coba lagi nanti.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
