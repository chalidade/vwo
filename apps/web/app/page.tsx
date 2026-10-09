import "./soon.css";

export const metadata = {
  title: "jobfair · Segera hadir",
  description: "Job fair virtual: jelajahi stand perusahaan, ngobrol dengan recruiter, ikut seminar, dan melamar kerja dari mana saja.",
};

const NOTES: Record<string, string> = {
  belum: "Akun ini belum punya akses sebelum rilis. Akses awal hanya untuk panitia, peserta early access, dan perusahaan yang sudah diverifikasi.",
  gagal: "Masuk dengan Google gagal. Coba lagi.",
};

/** jobfair.co.id before launch: what is coming, a way in for companies, and a quiet door for the team. */
export default async function ComingSoon({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const note = NOTES[q.akses ?? ""] ?? (q.login ? NOTES.gagal : null);
  return (
    <div className="cs">
      <div className="cs-glow a" />
      <div className="cs-glow b" />
      <div className="cs-glow c" />
      <div className="cs-floor" />
      <div className="cs-wrap">
        <header className="cs-top">
          <img className="cs-logo" src="/brand/jobfair-logo.png" alt="jobfair.co.id" width={74} height={79} />
          <span className="cs-pill">
            <span className="cs-dot" /> Segera hadir
          </span>
        </header>

        <section className="cs-hero">
          <div>
            {note && <p className="cs-note">{note}</p>}
            <p className="cs-kicker cs-rise">Job fair virtual</p>
            <h1 className="cs-h1 cs-rise d1">
              Datang ke job fair <span className="cs-shine">tanpa harus datang.</span>
            </h1>
            <p className="cs-sub cs-rise d2">
              Jelajahi aula pameran, mampir ke stand perusahaan, ngobrol langsung dengan recruiter, ikut seminar, dan kirim lamaran dari HP. Kami sedang menyiapkan pembukaannya.
            </p>
            <div className="cs-cta cs-rise d3">
              <a className="cs-btn primary" href="/daftar-perusahaan">
                Daftarkan perusahaan →
              </a>
              <a className="cs-btn ghost" href="/masuk-perusahaan">
                Masuk perusahaan
              </a>
            </div>
            <ul className="cs-chips">
              <li>🏬 Stand perusahaan interaktif</li>
              <li>💬 Chat & video call recruiter</li>
              <li>🎤 Seminar karier live</li>
              <li>🧠 Psikotes online</li>
              <li>📋 Lamar dalam satu klik</li>
            </ul>
          </div>
          <div className="cs-stage" aria-hidden>
            <div className="cs-ring" />
            <div className="cs-ring two" />
            <span className="cs-walker" style={{ ["--c" as string]: "#fde047" }} />
            <span className="cs-walker" />
            <span className="cs-walker" />
            <div className="cs-card c1">
              <b>Stand VIP</b>
              <span>12 lowongan dibuka</span>
              <i style={{ ["--w" as string]: "80%" }} />
            </div>
            <div className="cs-card c2">
              <b>Interview hari ini</b>
              <span>10.00 · video call</span>
              <i style={{ ["--w" as string]: "55%" }} />
            </div>
            <div className="cs-card c3">
              <b>Seminar karier</b>
              <span>Mulai 13.00</span>
              <i style={{ ["--w" as string]: "65%" }} />
            </div>
            <div className="cs-badge">
              <img src="/brand/jobfair-logo.png" alt="" width={90} height={96} />
            </div>
          </div>
        </section>

        <footer className="cs-foot">
          <span>© {new Date().getFullYear()} jobfair.co.id</span>
          <span>
            <a href="/masuk">Early access</a> · <a href="/masuk-panitia">Masuk panitia</a>
          </span>
        </footer>
      </div>
    </div>
  );
}
