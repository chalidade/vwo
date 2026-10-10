import { useEffect, useState } from "react";
import { BoothLogo } from "@vwo/ui";
import type { CompanyBooth } from "@vwo/shared";
import { COMPANY_TITLES, levelOf } from "../fair/content";
import { Stars } from "../fair/Modal";
import { NotifList } from "../fair/Notifs";
import { LIVE } from "../mode";
import { ACCOUNT_EVENT, checkSession, currentAccount } from "../account";
import { AccountGate } from "../AccountGate";
import { boothApplications, boothInboxRead, claimBooth, claimErrorText } from "../server-fair";
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
  return LIVE ? <LivePortal boothId={boothId} /> : <DemoPortal boothId={boothId} />;
}

function DemoPortal({ boothId }: { boothId?: string }) {
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

function useAccount() {
  const [account, setAccount] = useState(currentAccount);
  useEffect(() => {
    const on = () => setAccount(currentAccount());
    window.addEventListener(ACCOUNT_EVENT, on);
    return () => window.removeEventListener(ACCOUNT_EVENT, on);
  }, []);
  return account;
}

/** Live site: a company signs in with Google; its account runs the booths it joined with a code and PIN. */
function LivePortal({ boothId }: { boothId?: string }) {
  useFair();
  const account = useAccount();
  if (!account)
    return (
      <main className="cp cp-login">
        <div className="cp-login-card">
          <p className="muted small">Masuk dulu dengan akun Google kantor kamu untuk membuka portal perusahaan.</p>
          <AccountGate onIn={() => undefined} />
        </div>
      </main>
    );
  const mine = account.fairAdmin ? fair.fair.booths.map((b) => b.id) : (account.booths ?? []).filter((id) => fair.booth(id));
  const pick = boothId ?? (mine.length === 1 ? mine[0] : undefined);
  const booth = pick && mine.includes(pick) ? fair.booth(pick) : undefined;
  if (!booth) return <ClaimBooth code={boothId ?? ""} mine={mine} admin={!!account.fairAdmin} />;
  return <Portal key={booth.id} booth={booth} onOut={mine.length > 1 ? () => (location.hash = "#/jobfair/company") : undefined} />;
}

/** Live site: join a booth with the code and PIN from the organiser, or open one this account already runs. */
function ClaimBooth({ code: start, mine, admin }: { code: string; mine: string[]; admin: boolean }) {
  const [code, setCode] = useState(start);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const booths = mine.map((id) => fair.booth(id)!).sort((a, b) => a.company.localeCompare(b.company));
  return (
    <main className="cp cp-login">
      <form
        className="card cp-login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const id = code.trim().toLowerCase();
          setBusy(true);
          const r = await claimBooth(id, pin.trim());
          setBusy(false);
          if (!r.ok) return setError(claimErrorText(r.error));
          await checkSession();
          location.hash = `#/jobfair/company/${id}`;
        }}
      >
        <h1 className="cp-h1">🏢 Portal perusahaan</h1>
        {booths.length > 0 && (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>
              {admin ? "Kamu panitia: pilih stand yang mau dibuka." : "Stand yang dikelola akunmu:"}
            </p>
            <div className="cp-pick">
              {booths.map((b) => (
                <a key={b.id} className="cp-pick-item" style={{ ["--c" as string]: b.color }} href={`#/jobfair/company/${b.id}`}>
                  <BoothLogo booth={b} className="cp-logo" />
                  <span>
                    <b>
                      {b.company} {b.tier === "premium" && "👑"}
                    </b>
                    <span className="muted small">{b.id}</span>
                  </span>
                </a>
              ))}
            </div>
            <h2 className="cp-h2">Gabung ke stand lain</h2>
          </>
        )}
        <p className="muted small" style={{ marginTop: 0 }}>
          Masukkan kode perusahaan dan PIN dari panitia sekali saja. Setelah itu akun ini langsung membuka portal stand tersebut. Belum punya booth? <a href="/daftar-perusahaan">Daftarkan perusahaan</a>.
        </p>
        <label>
          Kode perusahaan
          <input value={code} onChange={(e) => (setCode(e.target.value), setError(""))} autoCapitalize="none" required placeholder="contoh: nusantara-tech" />
        </label>
        <label>
          PIN
          <input value={pin} onChange={(e) => (setPin(e.target.value.replace(/\D/g, "")), setError(""))} inputMode="numeric" autoComplete="one-time-code" type="password" required maxLength={6} placeholder="4–6 angka" />
        </label>
        {error && <p className="bk-err">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Memeriksa…" : "Gabung ke stand"}
        </button>
      </form>
    </main>
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
                <BoothLogo booth={b} className="cp-logo" />
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

function Portal({ booth, onOut }: { booth: CompanyBooth; onOut?: () => void }) {
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
  const [bell, setBell] = useState(false);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const unread = fair.unreadFor(booth.id);
  const server = useServerApplicants(booth.id);

  return (
    <main className="cp">
      <header className="cp-head card" style={{ ["--c" as string]: booth.color }}>
        <BoothLogo booth={booth} className="cp-logo cp-logo-big" />
        <div className="cp-head-text">
          <h1 className="cp-h1">
            {booth.company} {booth.tier === "premium" && <span className="cp-vip">👑 VIP</span>}
          </h1>
          <span className="muted small">
            {booth.industry} · Stand di {fair.fair.floors[booth.floor]?.name} · Recruiter {booth.recruiter}
          </span>
        </div>
        <div className="cp-head-links">
          <span className="nt-bell-wrap">
            <button type="button" className="small-btn ghost nt-bell" onClick={() => setBell((b) => !b)} aria-expanded={bell} aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`}>
              🔔{unread > 0 && <span className="cp-count">{unread}</span>}
            </button>
            {bell && (
              <div className="card nt-pop" role="dialog" aria-label="Notifikasi">
                <div className="nt-pop-head">
                  <b>Notifikasi</b>
                  {unread > 0 && (
                    <button type="button" className="small-btn ghost" onClick={() => fair.markRead(booth.id)}>
                      Tandai semua dibaca
                    </button>
                  )}
                </div>
                <NotifList
                  items={fair.notifsFor(booth.id)}
                  empty="Belum ada notifikasi. Lamaran baru, balasan chat, dan konfirmasi interview dari pelamar muncul di sini."
                  onPick={(n) => {
                    fair.markRead(booth.id, n.id);
                    setBell(false);
                    if (n.appId) setFocus({ id: n.appId, n: Date.now() });
                    setTab("applicants");
                  }}
                />
              </div>
            )}
          </span>
          <a className="small-btn cp-link" href="#/jobfair">
            🎪 Lihat di job fair
          </a>
          {onOut && (
            <button type="button" className="small-btn ghost" onClick={onOut}>
              {LIVE ? "Ganti stand" : "Keluar"}
            </button>
          )}
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
      {server && server !== "ok" && (
        <p className="card cp-server-note" role="status">
          {server === "signin"
            ? "Masuk dengan akun jobfair di halaman Job Fair dulu untuk melihat pelamar dari server."
            : server === "denied"
              ? "Akun ini belum terdaftar di stand ini. Buka portal perusahaan lalu gabung dengan kode dan PIN dari panitia."
              : "Tidak tersambung ke server. Daftar pelamar mungkin belum yang terbaru."}
        </p>
      )}
      {tab === "overview" && <Overview booth={booth} onTab={setTab} />}
      {tab === "applicants" && <Applicants key={focus?.n} booth={booth} focusId={focus?.id} />}
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
  // Interviews and office visits, soonest first.
  const upcoming = apps
    .flatMap((a) => [
      ...(a.interview ? [{ a, at: a.interview.at, what: `Interview · ${a.interview.mode}` }] : []),
      ...(a.visit ? [{ a, at: a.visit.at, what: "🏢 Kunjungan kantor" }] : []),
    ])
    .sort((x, y) => x.at - y.at);
  const unread = apps.filter((a) => a.messages?.length && a.messages[a.messages.length - 1]!.from === "seeker");
  const funnel = [
    ["Lamaran masuk", apps.length],
    ["Sudah dilihat", apps.length - by("Terkirim")],
    ["Shortlist", by("Shortlist") + by("Diundang interview") + by("Lolos interview") + by("Kunjungan kantor") + by("Diterima")],
    ["Diundang interview", by("Diundang interview") + by("Lolos interview") + by("Kunjungan kantor") + by("Diterima")],
    ["Lolos interview", by("Lolos interview") + by("Kunjungan kantor") + by("Diterima")],
    ["Kunjungan kantor", by("Kunjungan kantor") + by("Diterima")],
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
          ["Kunjungan kantor", by("Kunjungan kantor")],
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
          <h2 className="cp-h2">Jadwal interview & kunjungan</h2>
          {upcoming.length === 0 ? (
            <p className="muted small">Belum ada. Undang pelamar dari tab Pelamar.</p>
          ) : (
            <ul className="cp-ul">
              {upcoming.slice(0, 6).map(({ a, at, what }) => (
                <li key={`${a.id}:${what}`}>
                  <b>{new Date(at).toLocaleString("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b> · {a.name} · {a.jobTitle} ·{" "}
                  <span className="muted">{what}</span>
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

/** Live site: pull this booth's applications from the server while the portal is open. */
function useServerApplicants(boothId: string) {
  const [state, setState] = useState<"ok" | "signin" | "denied" | "offline" | null>(null);
  useEffect(() => {
    if (!LIVE) return;
    let gone = false;
    const pull = () =>
      void boothApplications(boothId).then((r) => {
        if (gone) return;
        if (r.ok) fair.mergeServer(r.data.applications, false);
        if (r.ok) void boothInboxRead(boothId).then((x) => !gone && x.ok && fair.setBoothRead(boothId, x.data.read));
        setState(r.ok ? "ok" : r.error === "not_signed_in" ? "signin" : r.error === "not_allowed" ? "denied" : "offline");
      });
    pull();
    const timer = window.setInterval(() => document.visibilityState === "visible" && pull(), 8_000);
    const back = () => document.visibilityState === "visible" && pull();
    document.addEventListener("visibilitychange", back);
    return () => {
      gone = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", back);
    };
  }, [boothId]);
  return state;
}
