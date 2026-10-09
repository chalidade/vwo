import { useEffect, useRef, useState, type ReactNode } from "react";
import { openJobs, type JobPosting } from "@vwo/shared";
import { BoothLogo } from "@vwo/ui";
import { FloorScene } from "./fair/FloorScene";
import { InstallButton } from "./install";
import { fair, useFair } from "./useFair";

const LOGO = `${import.meta.env.BASE_URL}brand/jobfair-logo.png`;

/** Line icons, drawn on a 24px grid with the current text colour. */
const ICONS: Record<string, ReactNode> = {
  booth: <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />,
  stage: <path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />,
  test: <path d="M9 4h6v3H9zM7 5H5v16h14V5h-2M8 12l2 2 4-4M8 17h8" />,
  call: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />,
  food: <path d="M4 3v8a3 3 0 0 0 6 0V3M7 3v18M17 3c-2 2-3 5-3 8h3v10" />,
  target: <path d="M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1 1 0 1 0 1 1M13 11l7-7M17 4h3v3" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  cal: <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3" />,
  pin: <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
  bag: <path d="M4 8h16v12H4zM9 8V5h6v3M4 13h16" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};
function Icon({ name, className = "lp-i" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

const FEATURES = [
  ["booth", "Stand perusahaan", "Jalan dari stand ke stand, ngobrol langsung dengan recruiter, baca banner lowongan, lalu kirim lamaran dalam dua ketukan.", "wide"],
  ["stage", "Seminar karier live", "Talkshow dan seminar disiarkan langsung di aula, lengkap dengan sertifikat.", ""],
  ["test", "Psikotes online", "Kerjakan psikotes di ruang ujian. Hasilnya bisa ikut terkirim bersama lamaran.", ""],
  ["target", "Misi, level & koin", "Kumpulkan stempel tiap stand, naik level, dan buka lantai premium dengan koin.", "wide"],
  ["call", "Konsultasi karier", "Telepon HR, career coach, atau psikolog langsung dari lounge.", ""],
  ["bag", "Profil & CV", "Simpan CV, foto, dan riwayat lamaran di satu profil yang dibawa ke setiap stand.", ""],
  ["food", "Food court", "Istirahat sebentar, beli voucher kuliner, dan dapat bonus job fair.", ""],
] as const;

const STEPS = [
  ["Buat profil & karakter", "Daftar, isi CV singkat, lalu pilih tampilan karaktermu. Cukup sekali, bisa diubah dari profil."],
  ["Kunjungi stand", "Naik lift ke lantai booth. Lihat lowongan, tanya recruiter, dan cek kecocokanmu dengan tiap posisi."],
  ["Lamar & interview", "Kirim lamaran dalam dua ketukan. Recruiter bisa langsung menelepon atau menjadwalkan interview."],
] as const;

const AUDIENCES = [
  ["Pencari kerja", "Datang dari HP, tanpa antre dan tanpa ongkos. Semua lamaran dan jadwal interview tercatat rapi.", "#/jobfair", "Masuk job fair"],
  ["Perusahaan", "Pesan stand, pasang lowongan dan video, lalu saring pelamar dengan skor kecocokan.", "#/jobfair/company", "Portal perusahaan"],
  ["Panitia", "Atur lantai, stand, seminar, dan rundown. Pantau pengunjung secara langsung.", "#/jobfair/admin", "Dashboard panitia"],
] as const;

const TYPES = ["Semua", "Full-time", "Magang", "Kontrak", "Part-time"] as const;

/** Which floors the preview cycles through: the booth floors first, then the rooms. */
function previewStops() {
  return [...fair.stops.filter((st) => !st.roomId), ...fair.stops.filter((st) => st.roomId && st.roomId !== "aula")];
}

/** Sections fade up the first time they scroll into view. */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === "undefined") {
      root?.querySelectorAll("[data-reveal]").forEach((el) => el.setAttribute("data-shown", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.setAttribute("data-shown", "");
            io.unobserve(e.target);
          }
      },
      { rootMargin: "0px 0px -60px 0px" },
    );
    const watch = () => root.querySelectorAll("[data-reveal]:not([data-shown])").forEach((el) => io.observe(el));
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return ref;
}

/** A number that counts up once it scrolls into view. */
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLElement>(null);
  const [n, setN] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const run = () => {
      if (started.current) return setN(to);
      started.current = true;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(to);
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 1100);
        setN(Math.round(to * (1 - (1 - p) ** 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (typeof IntersectionObserver === "undefined") return run();
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && (run(), io.disconnect()));
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <dt ref={ref}>{n}</dt>;
}

/** The home page for job seekers: what jobfair is, a live look inside, open jobs, and the way in. */
export function Landing() {
  useFair();
  const root = useReveal();
  const stops = previewStops();
  const [pick, setPick] = useState(0);
  const [auto, setAuto] = useState(true);
  const [type, setType] = useState<(typeof TYPES)[number]>("Semua");
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setPick((i) => i + 1), 8000);
    return () => clearInterval(id);
  }, [auto]);
  const stop = stops[pick % Math.max(1, stops.length)] ?? fair.stops[0]!;
  const here = [...fair.visitors.values()].filter((v) => v.floorId === stop.floorId).length + fair.staff.filter((x) => x.floorId === stop.floorId).length;
  const booths = fair.fair.booths;
  const allJobs = booths.flatMap((b) => openJobs(b).map((j) => ({ b, j })));
  const types = TYPES.filter((t) => t === "Semua" || allJobs.some(({ j }) => j.type === t));
  const shown = allJobs.filter(({ j }) => type === "Semua" || j.type === type).slice(0, 6);
  const online = fair.visitors.size;

  return (
    <div className="lp" ref={root}>
      <header className="lp-nav">
        <nav className="lp-nav-pill">
          <a href="#/" className="lp-brand" aria-label="jobfair, beranda">
            <img src={LOGO} alt="jobfair" />
          </a>
          <div className="lp-links">
            <a href="#lowongan">Lowongan</a>
            <a href="#alur">Cara kerja</a>
            <a href="#fitur">Fitur</a>
            <a href="#untuk">Perusahaan</a>
          </div>
          <a className="lp-nav-cta" href="#/jobfair">
            Masuk <Icon name="arrow" className="lp-i-sm" />
          </a>
        </nav>
      </header>

      <section className="lp-hero">
        <div aria-hidden className="lp-grid-bg" />
        <div aria-hidden className="lp-glow lp-glow-a" />

        <div className="lp-hero-inner">
          <div className="lp-hero-copy">
            <p className="lp-badge lp-in" style={{ ["--d" as string]: 0 }}>
              <span className="lp-pulse" aria-hidden />
              {online} pencari kerja sedang online
            </p>
            <h1 className="lp-in" style={{ ["--d" as string]: 1 }}>
              Langkah pertama ke <span className="lp-nw"><span className="lp-hl">karier impian</span>,</span> langsung dari HP.
            </h1>
            <p className="lp-lead lp-in" style={{ ["--d" as string]: 2 }}>
              Jelajahi job fair virtual dengan karaktermu sendiri. Temui recruiter dari {booths.length} perusahaan, ikut seminar karier, dan kirim lamaran tanpa antre.
            </p>
            <div className="lp-cta lp-in" style={{ ["--d" as string]: 3 }}>
              <a className="lp-btn" href="#/jobfair">
                Cari lowongan sekarang <Icon name="arrow" className="lp-i-sm" />
              </a>
              <a className="lp-btn lp-btn-ghost" href="#/jobfair/company">
                Saya perusahaan
              </a>
            </div>
            <ul className="lp-trust lp-in" style={{ ["--d" as string]: 4 }}>
              {["Gratis untuk pencari kerja", "Tanpa antre", "Lamar dalam 2 ketukan"].map((t) => (
                <li key={t}>
                  <Icon name="check" className="lp-i-sm" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="lp-hero-visual lp-in" style={{ ["--d" as string]: 3 }}>
            <div className="lp-frame">
              <div className="lp-frame-bar">
                <span className="lp-dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                <span className="lp-frame-title">
                  <b className="lp-live">● LIVE</b> {stop.name} · {stop.label}
                </span>
                <span className="lp-frame-count">{here} orang</span>
              </div>
              <a className="lp-frame-body" href="#/jobfair" aria-label={`Masuk job fair, mulai dari ${stop.label}`}>
                <FloorScene floorId={stop.floorId} className="lp-scene" />
              </a>
            </div>
            <div className="lp-float lp-float-a" aria-hidden>
              <span className="lp-float-ic">
                <Icon name="check" />
              </span>
              <span>
                <b>Lamaran terkirim</b>
                <small>Frontend Developer</small>
              </span>
            </div>
            <div className="lp-float lp-float-b" aria-hidden>
              <span className="lp-float-ic">
                <Icon name="cal" />
              </span>
              <span>
                <b>Undangan interview</b>
                <small>Besok, 10.00 WIB</small>
              </span>
            </div>
            <div className="lp-float lp-float-c" aria-hidden>
              <b>Kecocokan profil</b>
              <span className="lp-meter">
                <i />
              </span>
              <small>92% cocok</small>
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
        </div>
      </section>

      <section className="lp-strip" aria-label="Perusahaan yang membuka stand">
        <dl className="lp-stats" data-reveal>
          {(
            [
              [booths.length, "perusahaan"],
              [allJobs.length, "lowongan terbuka"],
              [fair.stops.length, "lantai"],
              [online, "sedang online"],
            ] as const
          ).map(([n, label]) => (
            <div key={label}>
              <CountUp to={n} />
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
        <div className="lp-marquee" aria-hidden>
          <div className="lp-marquee-track">
            {[...booths, ...booths].map((b, i) => (
              <span key={`${b.id}-${i}`} className="lp-co">
                <BoothLogo booth={b} className="lp-co-logo" />
                {b.company}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="lowongan">
        <div className="lp-head">
          <div>
            <p className="lp-kicker" data-reveal>
              Lowongan
            </p>
            <h2 data-reveal>Lowongan yang sedang dibuka</h2>
          </div>
          <div className="lp-filter" role="tablist" aria-label="Jenis pekerjaan" data-reveal>
            {types.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={t === type} onClick={() => setType(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="lp-jobs">
          {shown.map(({ b, j }, i) => (
            <JobCard key={`${type}-${b.id}-${j.id}`} company={b} job={j} d={i % 3} />
          ))}
        </div>
        <a className="lp-more" href="#/jobfair" data-reveal>
          Lihat semua {allJobs.length} lowongan di job fair <Icon name="arrow" className="lp-i-sm" />
        </a>
      </section>

      <section className="lp-section" id="alur">
        <p className="lp-kicker" data-reveal>
          Cara kerja
        </p>
        <h2 data-reveal>Dari daftar sampai interview, tiga langkah</h2>
        <ol className="lp-steps">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="lp-step" data-reveal style={{ ["--d" as string]: i }}>
              <span className="lp-step-n">{String(i + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-section" id="fitur">
        <p className="lp-kicker" data-reveal>
          Fitur
        </p>
        <h2 data-reveal>Semua yang ada di job fair sungguhan</h2>
        <p className="lp-sub" data-reveal>
          Tanpa antre panjang dan tanpa ongkos ke venue, tetapi tetap terasa ramai.
        </p>
        <div className="lp-bento">
          {FEATURES.map(([icon, title, text, size], i) => (
            <article key={title} className="lp-card lp-feature" data-wide={size ? "" : undefined} data-reveal style={{ ["--d" as string]: i % 3 }}>
              <span className="lp-icon">
                <Icon name={icon} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section" id="untuk">
        <p className="lp-kicker" data-reveal>
          Untuk siapa
        </p>
        <h2 data-reveal>Satu gedung, tiga pintu masuk</h2>
        <div className="lp-aud">
          {AUDIENCES.map(([who, text, href, cta], i) => (
            <a key={who} href={href} className="lp-card lp-aud-card" data-reveal style={{ ["--d" as string]: i }}>
              <h3>{who}</h3>
              <p>{text}</p>
              <span className="lp-aud-link">
                {cta} <Icon name="arrow" className="lp-i-sm" />
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="lp-final" data-reveal>
        <div className="lp-final-inner">
          <h2>Kerja impianmu mungkin ada di stand sebelah.</h2>
          <p>Buat profil dalam satu menit, lalu mulai jelajahi stand perusahaan.</p>
          <div className="lp-cta">
            <a className="lp-btn lp-btn-dark" href="#/jobfair">
              Masuk job fair <Icon name="arrow" className="lp-i-sm" />
            </a>
            <InstallButton className="lp-btn lp-btn-line" />
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <img src={LOGO} alt="jobfair" className="lp-foot-logo" />
        <span>Demo: data tersimpan di browser kamu dan pengunjung lain adalah bot.</span>
        <a href="#/jobfair/speaker">Halaman pembicara</a>
      </footer>
    </div>
  );
}

function JobCard({ company, job, d }: { company: Parameters<typeof BoothLogo>[0]["booth"]; job: JobPosting; d: number }) {
  return (
    <a href="#/jobfair" className="lp-job" data-reveal style={{ ["--d" as string]: d }}>
      <div className="lp-job-top">
        <BoothLogo booth={company} className="lp-co-logo lp-job-logo" />
        <span className="lp-job-type">{job.type}</span>
      </div>
      <h3>{job.title}</h3>
      <p className="lp-job-co">{company.company}</p>
      <div className="lp-job-meta">
        <span>
          <Icon name="pin" className="lp-i-sm" /> {job.location}
        </span>
        {job.salary && (
          <span>
            <Icon name="bag" className="lp-i-sm" /> Rp{job.salary}
          </span>
        )}
      </div>
      <span className="lp-job-go">
        Lamar di stand <Icon name="arrow" className="lp-i-sm" />
      </span>
    </a>
  );
}
