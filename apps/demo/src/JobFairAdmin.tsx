import { useEffect, useState } from "react";
import { LIVE } from "./mode";
import { fair, useFair } from "./useFair";
import {
  BadgeDollarSign,
  CalendarCheck,
  FileText,
  Brain,
  Building2,
  ClipboardList,
  FileChartColumn,
  FlaskConical,
  Headset,
  Landmark,
  Layers,
  Megaphone,
  Mic,
  Presentation,
  Radio,
  Store,
  Tent,
  Trash2,
  Trees,
  UtensilsCrossed,
} from "lucide-react";
import { DashShell } from "./Dash";
import { lazyPanel } from "./lazy-panel";

// Each tab loads its code when it is first opened.
const loading = <p className="muted">Memuat…</p>;
const OrgFoodCourt = lazyPanel(() => import("./organizer/FoodCourt").then((m) => m.OrgFoodCourt), loading);
const OrgAds = lazyPanel(() => import("./organizer/Ads").then((m) => m.OrgAds), loading);
const OrgAula = lazyPanel(() => import("./organizer/Aula").then((m) => m.OrgAula), loading);
const OrgBooths = lazyPanel(() => import("./organizer/Booths").then((m) => m.OrgBooths), loading);
const OrgConsultants = lazyPanel(() => import("./organizer/Consultants").then((m) => m.OrgConsultants), loading);
const OrgFloors = lazyPanel(() => import("./organizer/Floors").then((m) => m.OrgFloors), loading);
const OrgInvoices = lazyPanel(() => import("./organizer/Invoices").then((m) => m.OrgInvoices), loading);
const OrgLive = lazyPanel(() => import("./organizer/Live").then((m) => m.OrgLive), loading);
const OrgPark = lazyPanel(() => import("./organizer/Park").then((m) => m.OrgPark), loading);
const OrgPrices = lazyPanel(() => import("./organizer/Prices").then((m) => m.OrgPrices), loading);
const OrgPsych = lazyPanel(() => import("./organizer/Psych").then((m) => m.OrgPsych), loading);
const OrgEarlyAccess = lazyPanel(() => import("./organizer/EarlyAccess").then((m) => m.OrgEarlyAccess), loading);
const OrgEvents = lazyPanel(() => import("./organizer/Events").then((m) => m.OrgEvents), loading);
const OrgRegistrations = lazyPanel(() => import("./organizer/Registrations").then((m) => m.OrgRegistrations), loading);
const OrgReports = lazyPanel(() => import("./organizer/Reports").then((m) => m.OrgReports), loading);
const OrgSeminars = lazyPanel(() => import("./organizer/Seminars").then((m) => m.OrgSeminars), loading);

const TABS = [
  ["live", Radio, "Live"],
  ["floors", Layers, "Lantai"],
  ["park", Trees, "Taman"],
  ["booths", Store, "Stand"],
  ["registrations", ClipboardList, "Pendaftaran"],
  ["early", FlaskConical, "Early access"],
  ["events", CalendarCheck, "Pra-registrasi"],
  ["ads", Megaphone, "Iklan & pendapatan"],
  ["prices", BadgeDollarSign, "Harga & koin"],
  ["invoices", FileText, "Invoice & pajak"],
  ["psych", Brain, "Psikotes"],
  ["seminar", Presentation, "Seminar"],
  ["aula", Landmark, "Aula"],
  ["food", UtensilsCrossed, "Food Court"],
  ["consult", Headset, "Konsultan"],
  ["reports", FileChartColumn, "Laporan event"],
] as const;
type OrgTab = (typeof TABS)[number][0];
const GROUPS: { label: string; ids: OrgTab[] }[] = [
  { label: "Pantau", ids: ["live", "registrations", "events", "early"] },
  { label: "Acara", ids: ["floors", "park", "booths", "aula", "seminar", "psych", "food", "consult", "reports"] },
  { label: "Bisnis", ids: ["ads", "prices", "invoices"] },
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
            <span className="cp-logo">
              <Tent size={18} aria-hidden />
            </span>
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
            <a className="small-btn ghost cp-link" href="#/jobfair/konsultan">
              <Headset size={16} aria-hidden /> Konsultan
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
        {tab === "park" && <OrgPark onToast={setToast} />}
        {tab === "booths" && <OrgBooths onToast={setToast} />}
        {tab === "registrations" && <OrgRegistrations onToast={setToast} />}
        {tab === "early" && <OrgEarlyAccess onToast={setToast} />}
        {tab === "events" && <OrgEvents onToast={setToast} />}
        {tab === "ads" && <OrgAds onToast={setToast} />}
        {tab === "prices" && <OrgPrices onToast={setToast} />}
        {tab === "invoices" && <OrgInvoices onToast={setToast} />}
        {tab === "psych" && <OrgPsych onToast={setToast} />}
        {tab === "seminar" && <OrgSeminars onToast={setToast} />}
        {tab === "aula" && <OrgAula onToast={setToast} />}
        {tab === "food" && <OrgFoodCourt onToast={setToast} />}
        {tab === "consult" && <OrgConsultants onToast={setToast} />}
        {tab === "reports" && <OrgReports onToast={setToast} />}
      </DashShell>
      {toast && <div className="cp-toast">{toast}</div>}
    </main>
  );
}
