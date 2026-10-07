import { useEffect, useState } from "react";
import { OrgAds } from "./organizer/Ads";
import { OrgBooths } from "./organizer/Booths";
import { OrgLive } from "./organizer/Live";
import { OrgPsych } from "./organizer/Psych";
import { OrgSeminars } from "./organizer/Seminars";
import { fair, useFair } from "./useFair";

const TABS = [
  ["live", "📡 Live"],
  ["booths", "🏬 Stand"],
  ["ads", "📣 Iklan"],
  ["psych", "🧠 Psikotes"],
  ["seminar", "🎤 Seminar"],
] as const;
type OrgTab = (typeof TABS)[number][0];

const TAB_KEY = "vwo:org-tab";
const loadTab = (): OrgTab => {
  try {
    const t = localStorage.getItem(TAB_KEY);
    return TABS.some(([id]) => id === t) ? (t as OrgTab) : "live";
  } catch {
    return "live";
  }
};

/** The organiser's hub: the hall live, the booths, every ad, the psikotes and the seminar programme. */
export function JobFairAdmin() {
  useFair();
  const [tab, setTabState] = useState<OrgTab>(loadTab);
  const [toast, setToast] = useState<string | null>(null);
  const setTab = (t: OrgTab) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // Not remembered: fine.
    }
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <main className="cp org-hub">
      <header className="card cp-head" style={{ ["--c" as string]: "#f97316" }}>
        <span className="cp-logo cp-logo-big">🎪</span>
        <div className="cp-head-text">
          <h1 className="cp-h1">Panitia · {fair.fair.name}</h1>
          <span className="muted small">Data demo tersimpan di browser ini. Perubahan langsung tampil di job fair.</span>
        </div>
        <div className="cp-head-links">
          <a className="small-btn cp-link" href="#/jobfair">
            🎪 Buka job fair
          </a>
          <button
            type="button"
            className="small-btn ghost"
            onClick={() => {
              if (confirm("Hapus semua data demo job fair (lamaran, kunjungan, pengaturan panitia) di browser ini?")) fair.reset();
            }}
          >
            Hapus data demo
          </button>
        </div>
      </header>
      <nav className="cp-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} data-active={tab === id ? "" : undefined} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === "live" && <OrgLive />}
      {tab === "booths" && <OrgBooths onToast={setToast} />}
      {tab === "ads" && <OrgAds onToast={setToast} />}
      {tab === "psych" && <OrgPsych onToast={setToast} />}
      {tab === "seminar" && <OrgSeminars onToast={setToast} />}
      {toast && <div className="cp-toast">{toast}</div>}
    </main>
  );
}
