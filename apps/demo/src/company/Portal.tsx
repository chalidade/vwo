import { useState } from "react";
import type { CompanyBooth } from "@vwo/shared";
import { COMPANY_TITLES, levelOf } from "../fair/content";
import { Stars } from "../fair/Modal";
import { fair, useFair } from "../useFair";
import { Applicants } from "./Applicants";
import { sessionLogin, signedInCompany } from "./login";
import { Billing } from "./Billing";
import { BoothEditor, FaqEditor, JobsEditor, ProfileEditor } from "./Editors";

const TABS = [
  ["overview", "📊 Ringkasan"],
  ["applicants", "📋 Pelamar"],
  ["jobs", "💼 Lowongan"],
  ["booth", "🎨 Booth"],
  ["profile", "🏢 Profil"],
  ["faq", "❓ FAQ"],
  ["billing", "👑 VIP & tagihan"],
] as const;
export type PortalTab = (typeof TABS)[number][0];

const TAB_KEY = "vwo:company-tab";
const loadTab = (): PortalTab => {
  try {
    const t = localStorage.getItem(TAB_KEY);
    return TABS.some(([id]) => id === t) ? (t as PortalTab) : "overview";
  } catch {
    return "overview";
  }
};

/** The company portal: a company signs in with its code and PIN, then manages its booth, vacancies and applicants. */
export function CompanyPortal({ boothId }: { boothId?: string }) {
  useFair();
  const [who, setWho] = useState(signedInCompany);
  const booth = who ? fair.booth(who) : undefined;
  if (!booth || (boothId && boothId !== booth.id)) return <CompanyLogin code={boothId ?? ""} onIn={setWho} />;
  return (
    <Portal
      key={booth.id}
      booth={booth}
      onOut={() => {
        sessionLogin(null);
        setWho(null);
        location.hash = "#/jobfair/company";
      }}
    />
  );
}

/** Company sign-in: company code and PIN from the organiser or from booking a stand. */
function CompanyLogin({ code: start, onIn }: { code: string; onIn: (id: string) => void }) {
  const [code, setCode] = useState(start);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const booths = [...fair.fair.booths].sort((a, b) => a.company.localeCompare(b.company));
  return (
    <main className="cp cp-login">
      <form
        className="card cp-login-card"
        onSubmit={(e) => {
          e.preventDefault();
          const b = fair.companyLogin(code, pin);
          if (!b) return setError(true);
          sessionLogin(b.id);
          location.hash = `#/jobfair/company/${b.id}`;
          onIn(b.id);
        }}
      >
        <h1 className="cp-h1">🏢 Masuk portal perusahaan</h1>
        <p className="muted small" style={{ marginTop: 0 }}>
          Kelola stand, lowongan, dan pelamar di {fair.fair.name}. Kode dan PIN dikirim panitia, atau kamu dapat saat booking stand kosong di peta.
        </p>
        <label>
          Kode perusahaan
          <input value={code} onChange={(e) => (setCode(e.target.value), setError(false))} autoComplete="username" autoCapitalize="none" required placeholder="contoh: nusantara-tech" />
        </label>
        <label>
          PIN
          <input value={pin} onChange={(e) => (setPin(e.target.value.replace(/\D/g, "")), setError(false))} inputMode="numeric" autoComplete="current-password" type="password" required maxLength={6} placeholder="4–6 angka" />
        </label>
        {error && <p className="bk-err">Kode atau PIN salah. Tanyakan ke panitia kalau lupa.</p>}
        <button type="submit">Masuk</button>
        <details className="cp-demo-accounts">
          <summary>Akun demo</summary>
          <p className="muted small">Hanya ada di demo. Ketuk untuk mengisi otomatis.</p>
          <div className="cp-pick">
            {booths.map((b) => (
              <button
                key={b.id}
                type="button"
                className="cp-pick-item"
                style={{ ["--c" as string]: b.color }}
                onClick={() => {
                  setCode(b.id);
                  setPin(fair.companyPin(b.id));
                  setError(false);
                }}
              >
                <span className="cp-logo">{b.logo}</span>
                <span>
                  <b>
                    {b.company} {b.tier === "premium" && "👑"}
                  </b>
                  <span className="muted small">
                    {b.id} · PIN {fair.companyPin(b.id)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </details>
      </form>
    </main>
  );
}

function Portal({ booth, onOut }: { booth: CompanyBooth; onOut: () => void }) {
  const [tab, setTabState] = useState<PortalTab>(loadTab);
  const setTab = (t: PortalTab) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // Not remembered: fine.
    }
  };
  const apps = fair.applications.filter((a) => a.boothId === booth.id);
  const fresh = apps.filter((a) => a.status === "Terkirim" || a.status === "Dilihat").length;

  return (
    <main className="cp">
      <header className="cp-head card" style={{ ["--c" as string]: booth.color }}>
        <span className="cp-logo cp-logo-big">{booth.logo}</span>
        <div className="cp-head-text">
          <h1 className="cp-h1">
            {booth.company} {booth.tier === "premium" && <span className="cp-vip">👑 VIP</span>}
          </h1>
          <span className="muted small">
            {booth.industry} · Stand di {fair.fair.floors[booth.floor]?.name} · Recruiter {booth.recruiter}
          </span>
        </div>
        <div className="cp-head-links">
          <a className="small-btn cp-link" href="#/jobfair">
            🎪 Lihat di job fair
          </a>
          <button type="button" className="small-btn ghost" onClick={onOut}>
            Keluar
          </button>
        </div>
      </header>
      <nav className="cp-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} data-active={tab === id ? "" : undefined} onClick={() => setTab(id)}>
            {label}
            {id === "applicants" && fresh > 0 && <span className="cp-count">{fresh}</span>}
          </button>
        ))}
      </nav>
      {tab === "overview" && <Overview booth={booth} onTab={setTab} />}
      {tab === "applicants" && <Applicants booth={booth} />}
      {tab === "jobs" && <JobsEditor booth={booth} />}
      {tab === "booth" && <BoothEditor booth={booth} onTab={setTab} />}
      {tab === "profile" && <ProfileEditor booth={booth} />}
      {tab === "faq" && <FaqEditor booth={booth} />}
      {tab === "billing" && <Billing booth={booth} />}
    </main>
  );
}

function Overview({ booth, onTab }: { booth: CompanyBooth; onTab: (t: PortalTab) => void }) {
  const apps = fair.applications.filter((a) => a.boothId === booth.id);
  const rating = fair.companyRating(booth.id);
  const lv = levelOf(fair.companyXp(booth.id));
  const by = (s: string) => apps.filter((a) => a.status === s).length;
  const upcoming = apps.filter((a) => a.interview).sort((a, b) => a.interview!.at - b.interview!.at);
  const unread = apps.filter((a) => a.messages?.length && a.messages[a.messages.length - 1]!.from === "seeker");
  const funnel = [
    ["Lamaran masuk", apps.length],
    ["Sudah dilihat", apps.length - by("Terkirim")],
    ["Shortlist", by("Shortlist") + by("Diundang interview") + by("Diterima")],
    ["Diundang interview", by("Diundang interview") + by("Diterima")],
    ["Diterima", by("Diterima")],
  ] as const;
  const todo = [
    !booth.theme && { text: "Pilih tema booth supaya stand tampil beda", tab: "booth" as const },
    booth.faq.length < 3 && { text: "Tambah FAQ supaya recruiter bisa menjawab pengunjung", tab: "faq" as const },
    !booth.phone && { text: "Isi nomor HP/WhatsApp HR di profil", tab: "profile" as const },
    booth.jobs.some((j) => !j.description) && { text: "Lengkapi deskripsi lowongan", tab: "jobs" as const },
    booth.tier !== "premium" && { text: "Upgrade ke stand VIP untuk lampu sorot dan LED berjalan", tab: "billing" as const },
  ].filter(Boolean) as { text: string; tab: PortalTab }[];

  return (
    <div className="cp-grid">
      <div className="cp-kpis">
        {[
          ["Di stand sekarang", fair.peopleAt(booth.id)],
          ["Kunjungan stand", fair.visits.get(booth.id) ?? 0],
          ["Pelamar", apps.length],
          ["Perlu direview", by("Terkirim") + by("Dilihat")],
          ["Interview", by("Diundang interview")],
          ["Lowongan aktif", booth.jobs.filter((j) => !j.closed).length],
        ].map(([label, n]) => (
          <div key={label} className="card cp-kpi">
            <span className="muted small">{label}</span>
            <span className="stat">{n}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <h2 className="cp-h2">Corong rekrutmen</h2>
        {funnel.map(([label, n]) => (
          <div key={label} className="cp-funnel">
            <span>{label}</span>
            <span className="fx-bar">
              <span style={{ width: `${apps.length ? (n / apps.length) * 100 : 0}%`, background: booth.color }} />
            </span>
            <b>{n}</b>
          </div>
        ))}
        <h2 className="cp-h2">Pelamar per lowongan</h2>
        <table className="list cp-table">
          <tbody>
            {booth.jobs.map((j) => (
              <tr key={j.id}>
                <td>
                  {j.title} {j.closed && <span className="status">Ditutup</span>}
                </td>
                <td>{apps.filter((a) => a.jobId === j.id).length} pelamar</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cp-side">
        <div className="card">
          <h2 className="cp-h2">Reputasi</h2>
          <Stars value={rating.average} count={rating.count} />
          <p className="small" style={{ margin: "6px 0 0" }}>
            Level {lv.level} · {COMPANY_TITLES[lv.level - 1]}
          </p>
        </div>
        <div className="card">
          <h2 className="cp-h2">Jadwal interview</h2>
          {upcoming.length === 0 ? (
            <p className="muted small">Belum ada. Undang pelamar dari tab Pelamar.</p>
          ) : (
            <ul className="cp-ul">
              {upcoming.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <b>{new Date(a.interview!.at).toLocaleString("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b> · {a.name} · {a.jobTitle} ·{" "}
                  <span className="muted">{a.interview!.mode}</span>
                </li>
              ))}
            </ul>
          )}
          {unread.length > 0 && (
            <button type="button" className="small-btn" onClick={() => onTab("applicants")}>
              💬 {unread.length} balasan pelamar
            </button>
          )}
        </div>
        {todo.length > 0 && (
          <div className="card">
            <h2 className="cp-h2">Lengkapi stand kamu</h2>
            <ul className="cp-todo">
              {todo.map((t) => (
                <li key={t.text}>
                  <button type="button" className="cp-linkbtn" onClick={() => onTab(t.tab)}>
                    {t.text} →
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
