import { OrgFoodCourt } from "./organizer/FoodCourt";
import { useEffect, useState } from "react";
import { OrgAds } from "./organizer/Ads";
import { OrgAula } from "./organizer/Aula";
import { OrgBooths } from "./organizer/Booths";
import { OrgFloors } from "./organizer/Floors";
import { OrgLive } from "./organizer/Live";
import { OrgPrices } from "./organizer/Prices";
import { OrgPsych } from "./organizer/Psych";
import { OrgEarlyAccess } from "./organizer/EarlyAccess";
import { OrgRegistrations } from "./organizer/Registrations";
import { OrgSeminars } from "./organizer/Seminars";
import { LIVE } from "./mode";
import { fair, useFair } from "./useFair";
import { BadgeDollarSign, Brain, Building2, ClipboardList, FlaskConical, Landmark, Layers, Megaphone, Mic, Presentation, Radio, Store, Tent, Trash2, UtensilsCrossed } from "lucide-react";
import { DashShell } from "./Dash";

const TABS = [
  ["live", Radio, "Live"],
  ["floors", Layers, "Lantai"],
  ["booths", Store, "Stand"],
  ["registrations", ClipboardList, "Pendaftaran"],
  ["early", FlaskConical, "Early access"],
  ["ads", Megaphone, "Iklan & pendapatan"],
  ["prices", BadgeDollarSign, "Harga & koin"],
  ["psych", Brain, "Psikotes"],
  ["seminar", Presentation, "Seminar"],
  ["aula", Landmark, "Aula"],
  ["food", UtensilsCrossed, "Food Court"],
] as const;
type OrgTab = (typeof TABS)[number][0];
const GROUPS: { label: string; ids: OrgTab[] }[] = [
  { label: "Pantau", ids: ["live", "registrations", "early"] },
  { label: "Acara", ids: ["floors", "booths", "aula", "seminar", "psych", "food"] },
  { label: "Bisnis", ids: ["ads", "prices"] },
];

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
export function JobFairAdmin({ tab: fromRoute }: { tab?: string }) {
  useFair();
  const [saved, setTabState] = useState<OrgTab>(loadTab);
  const tab = TABS.some(([id]) => id === fromRoute) ? (fromRoute as OrgTab) : saved;
  const [toast, setToast] = useState<string | null>(null);
  const setTab = (t: OrgTab) => {
    setTabState(t);
    location.hash = `#/jobfair/admin/${t}`;
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
    <main className="cp cp-dash org-hub">
      <DashShell
        accent="#f97316"
        brand={
          <>
            <span className="cp-logo">🎪</span>
            <span className="dash-brand-text">
              <b>Panitia</b>
              <span>{fair.fair.name}</span>
            </span>
          </>
        }
        title={`Panitia · ${fair.fair.name}`}
        primary={["live", "registrations", "booths", "prices"]}
        subtitle={LIVE ? "Perubahan tersimpan di server dan langsung tampil untuk semua pengunjung." : "Data demo tersimpan di browser ini. Perubahan langsung tampil di job fair."}
        groups={GROUPS.map((g) => ({ label: g.label, items: g.ids.map((id) => ({ id, icon: TABS.find(([x]) => x === id)![1], label: TABS.find(([x]) => x === id)![2] })) }))}
        active={tab}
        onPick={setTab}
        actions={
          <>
            <a className="small-btn cp-link" href="#/jobfair">
              <Tent size={16} aria-hidden /> Buka job fair
            </a>
            <a className="small-btn ghost cp-link" href="#/jobfair/company">
              <Building2 size={16} aria-hidden /> Portal perusahaan
            </a>
            <a className="small-btn ghost cp-link" href="#/jobfair/speaker">
              <Mic size={16} aria-hidden /> Pembicara
            </a>
            {!LIVE && (
              <button
                type="button"
                className="small-btn ghost"
                onClick={() => {
                  if (confirm("Hapus semua data demo job fair (lamaran, kunjungan, pengaturan panitia) di browser ini?")) fair.reset();
                }}
              >
                <Trash2 size={16} aria-hidden /> Hapus data demo
              </button>
            )}
          </>
        }
      >
      {tab === "live" && <OrgLive />}
      {tab === "floors" && <OrgFloors onToast={setToast} />}
      {tab === "booths" && <OrgBooths onToast={setToast} />}
      {tab === "registrations" && <OrgRegistrations onToast={setToast} />}
      {tab === "early" && <OrgEarlyAccess onToast={setToast} />}
      {tab === "ads" && <OrgAds onToast={setToast} />}
      {tab === "prices" && <OrgPrices onToast={setToast} />}
      {tab === "psych" && <OrgPsych onToast={setToast} />}
      {tab === "seminar" && <OrgSeminars onToast={setToast} />}
      {tab === "aula" && <OrgAula onToast={setToast} />}
      {tab === "food" && <OrgFoodCourt onToast={setToast} />}
      </DashShell>
      {toast && <div className="cp-toast">{toast}</div>}
    </main>
  );
}
