import { useEffect, useState } from "react";
import { openJobs } from "@vwo/shared";
import { FloorScene } from "./fair/FloorScene";
import { InstallButton } from "./install";
import { fair, useFair } from "./useFair";

const FEATURES = [
  ["🏬", "Stand perusahaan", "Jalan dari stand ke stand, ngobrol dengan recruiter, baca banner lowongan, lalu kirim lamaran dalam dua ketukan."],
  ["🎤", "Seminar & Aula live", "Talkshow dan seminar karier disiarkan langsung di panggung. Duduk, tonton, dan dapat sertifikat."],
  ["🧠", "Psikotes", "Kerjakan psikotes di ruang ujian. Hasilnya ikut terkirim bersama lamaranmu kalau kamu mau."],
  ["📞", "Lounge konsultasi", "Telepon HR, career coach, atau psikolog langsung dari sofa lounge."],
  ["🍜", "Food court", "Istirahat di food court, beli voucher dari brand kuliner, dan dapat bonus job fair."],
  ["🎯", "Misi, level & koin", "Kumpulkan stempel stand, naik level, dan pakai koin untuk lantai premium dan fitur ekstra."],
] as const;

const STEPS = [
  ["1", "Buat karakter", "Daftar, pilih rambut, baju, dan gaya kamu. Cukup sekali, bisa diubah lagi dari profil."],
  ["2", "Jelajahi gedung", "Naik lift ke lantai booth, ruang seminar, psikotes, lounge, sampai food court."],
  ["3", "Lamar & interview", "Kirim lamaran ke stand yang cocok. HR bisa langsung menelepon atau mengundang interview."],
] as const;

const AUDIENCES = [
  ["🧑‍🎓", "Pencari kerja", "Datang ke job fair dari HP, tanpa antre dan tanpa ongkos. Semua lamaran tercatat di tas kamu.", "#/jobfair", "Masuk job fair"],
  ["🏢", "Perusahaan", "Pesan stand, hias booth, pasang lowongan dan video, lalu lihat pelamar dengan skor kecocokan.", "#/jobfair/company", "Portal perusahaan"],
  ["🎪", "Panitia", "Atur lantai, stand, iklan, seminar, dan rundown. Pantau pengunjung secara langsung.", "#/jobfair/admin", "Dashboard panitia"],
] as const;

/** Which floors the preview cycles through: the booth floors first, then the rooms. */
function previewStops() {
  return [...fair.stops.filter((st) => !st.roomId), ...fair.stops.filter((st) => st.roomId && st.roomId !== "aula")];
}

/** The home page: what VWO is, a live look inside, and the way in. */
export function Landing() {
  useFair();
  const stops = previewStops();
  const [pick, setPick] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setPick((i) => i + 1), 8000);
    return () => clearInterval(id);
  }, [auto]);
  const stop = stops[pick % Math.max(1, stops.length)] ?? fair.stops[0]!;
  const here = [...fair.visitors.values()].filter((v) => v.floorId === stop.floorId).length + fair.staff.filter((x) => x.floorId === stop.floorId).length;
  const jobs = fair.fair.booths.reduce((n, b) => n + openJobs(b).length, 0);

  return (
    <div className="lp">
      <header className="lp-nav">
        <a href="#/" className="lp-brand">
          <span className="lp-logo">🌐</span> VWO
        </a>
        <nav className="lp-links">
          <a href="#fitur">Fitur</a>
          <a href="#cara">Cara kerja</a>
          <a href="#untuk">Untuk siapa</a>
        </nav>
        <a className="lp-btn lp-btn-sm" href="#/jobfair">
          Masuk
        </a>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-text">
          <span className="lp-eyebrow">
            <i className="lp-dot" /> Job fair virtual · bisa dari HP
          </span>
          <h1>
            Datang ke job fair, <span className="lp-hl">tanpa harus datang.</span>
          </h1>
          <p className="lp-lead">
            VWO adalah gedung job fair yang kamu jelajahi dengan karakter sendiri. Naik lift, mampir ke stand, ngobrol dengan recruiter, ikut seminar, lalu kirim lamaran, semuanya dari browser.
          </p>
          <div className="lp-cta">
            <a className="lp-btn" href="#/jobfair">
              ▶ Masuk Job Fair
            </a>
            <a className="lp-btn lp-btn-ghost" href="#/jobfair/company">
              Buka stand perusahaan
            </a>
          </div>
          <dl className="lp-stats">
            <div>
              <dt>{fair.fair.booths.length}</dt>
              <dd>perusahaan</dd>
            </div>
            <div>
              <dt>{jobs}</dt>
              <dd>lowongan</dd>
            </div>
            <div>
              <dt>{fair.stops.length}</dt>
              <dd>lantai</dd>
            </div>
            <div>
              <dt>{fair.visitors.size}</dt>
              <dd>sedang online</dd>
            </div>
          </dl>
        </div>

        <div className="lp-preview">
          <div className="lp-window">
            <div className="lp-window-bar">
              <span className="lp-live">● LIVE</span>
              <span className="lp-window-title">
                {stop.name} · {stop.emoji} {stop.label}
              </span>
              <span className="lp-window-count">👥 {here} orang</span>
            </div>
            <a className="lp-window-body" href="#/jobfair" aria-label={`Masuk job fair, mulai dari ${stop.label}`}>
              <FloorScene floorId={stop.floorId} className="lp-scene" />
              <span className="lp-enter">Masuk ke sini ▶</span>
            </a>
          </div>
          <div className="lp-chips" role="tablist" aria-label="Lihat lantai lain">
            {stops.map((st, i) => (
              <button
                key={st.floorId}
                type="button"
                role="tab"
                aria-selected={st.floorId === stop.floorId}
                onClick={() => {
                  setPick(i);
                  setAuto(false);
                }}
              >
                {st.emoji} {st.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="cara">
        <h2>Tiga langkah, langsung masuk</h2>
        <ol className="lp-steps">
          {STEPS.map(([n, title, text]) => (
            <li key={n}>
              <b className="lp-step-n">{n}</b>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-section" id="fitur">
        <h2>Semua yang ada di job fair sungguhan</h2>
        <p className="lp-sub">Tanpa antre panjang, tanpa ongkos ke venue, dan tetap terasa ramai.</p>
        <div className="lp-grid">
          {FEATURES.map(([icon, title, text]) => (
            <article key={title} className="lp-card">
              <span className="lp-icon">{icon}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section" id="untuk">
        <h2>Satu gedung, tiga pintu</h2>
        <div className="lp-aud">
          {AUDIENCES.map(([icon, who, text, href, cta]) => (
            <article key={who} className="lp-card lp-aud-card">
              <span className="lp-icon">{icon}</span>
              <h3>{who}</h3>
              <p>{text}</p>
              <a href={href}>{cta} →</a>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-final">
        <h2>Siap cari kerja dengan cara yang lebih seru?</h2>
        <p>Buat karakter dalam satu menit, lalu mulai jelajahi stand.</p>
        <div className="lp-cta">
          <a className="lp-btn" href="#/jobfair">
            ▶ Masuk Job Fair
          </a>
          <InstallButton className="lp-btn lp-btn-ghost" />
        </div>
      </section>

      <footer className="lp-foot">
        <span>🌐 VWO · Virtual World Job</span>
        <span>
          Demo: data tersimpan di browser kamu dan pengunjung lain adalah bot. <a href="#/jobfair/speaker">Halaman pembicara</a>
        </span>
      </footer>
    </div>
  );
}
