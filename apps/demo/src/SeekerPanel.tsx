import { useState } from "react";
import type { CompanyBooth } from "@vwo/shared";
import { type Look, Person } from "@vwo/ui";
import type { FairApplication } from "./jobfair-engine";
import type { SeekerProfile } from "./profile";

export type SeekerTab = "profile" | "applications" | "stamps";

const FIELDS: { key: keyof SeekerProfile; label: string; placeholder?: string; type?: string }[] = [
  { key: "name", label: "Nama lengkap" },
  { key: "headline", label: "Status", placeholder: "Fresh graduate Teknik Informatika" },
  { key: "email", label: "Email", type: "email", placeholder: "nama@email.com" },
  { key: "phone", label: "No. HP", type: "tel", placeholder: "08xx" },
  { key: "city", label: "Domisili", placeholder: "Jakarta" },
  { key: "education", label: "Pendidikan", placeholder: "S1 Informatika, 2025" },
  { key: "skills", label: "Keahlian", placeholder: "React, Excel, desain" },
  { key: "cvUrl", label: "Link CV", type: "url", placeholder: "https://" },
];

const when = (at: number) => new Date(at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The job seeker's bag: profile, every application sent, and a stamp card of booths visited. */
export function SeekerPanel({
  tab: startTab = "profile",
  look,
  profile,
  applications,
  booths,
  visited,
  onSaveProfile,
  onOpenJob,
  onOpenCompany,
  onGoTo,
  onReset,
  onClose,
}: {
  tab?: SeekerTab;
  look: Look;
  profile: SeekerProfile;
  applications: FairApplication[];
  booths: CompanyBooth[];
  visited: Set<string>;
  onSaveProfile: (p: SeekerProfile) => void;
  onOpenJob: (boothId: string, jobId: string) => void;
  onOpenCompany: (boothId: string) => void;
  onGoTo: (boothId: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<SeekerTab>(startTab);
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);
  const companies = new Set(applications.map((a) => a.boothId));
  const invited = applications.filter((a) => a.status === "Diundang interview").length;
  const boothOf = (id: string) => booths.find((b) => b.id === id);

  return (
    <div className="mb-backdrop" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
      <div className="rpg-box mb sp" role="dialog" aria-label="Profil dan lamaran" onClick={(e) => e.stopPropagation()}>
        <div className="mb-head">
          <span className="mb-title">🎒 Tas pencari kerja</span>
          <button type="button" className="mb-close" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="mb-tabs">
          {(
            [
              ["profile", "👤 Profil"],
              ["applications", `📋 Lamaran (${applications.length})`],
              ["stamps", `🏅 Stempel (${visited.size}/${booths.length})`],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" data-active={tab === id ? "" : undefined} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="mb-page sp-page">
          {tab === "profile" && (
            <div className="sp-profile">
              <div className="sp-card">
                <div className="sp-avatar rpg-sprite-preview" data-dir="down">
                  <div className="pg-flip">
                    <Person look={look} size={1.6} />
                  </div>
                </div>
                <div>
                  <div className="sp-name">{profile.name || "Tanpa nama"}</div>
                  <div className="sp-muted">{profile.headline || "Lengkapi profilmu supaya form lamaran terisi otomatis."}</div>
                  <div className="sp-stats">
                    <span>
                      <b>{applications.length}</b> lamaran
                    </span>
                    <span>
                      <b>{companies.size}</b> perusahaan
                    </span>
                    <span>
                      <b>{invited}</b> undangan interview
                    </span>
                    <span>
                      <b>{visited.size}</b> stand dikunjungi
                    </span>
                  </div>
                </div>
              </div>
              <form
                className="jb-fields"
                onSubmit={(e) => {
                  e.preventDefault();
                  onSaveProfile(form);
                  setSaved(true);
                }}
              >
                {FIELDS.map((f) => (
                  <label key={f.key} className="sp-field">
                    <span>{f.label}</span>
                    <input
                      type={f.type ?? "text"}
                      value={form[f.key]}
                      placeholder={f.placeholder}
                      maxLength={f.key === "cvUrl" ? 300 : 80}
                      onChange={(e) => {
                        setForm({ ...form, [f.key]: e.target.value });
                        setSaved(false);
                      }}
                    />
                  </label>
                ))}
                <div className="sp-actions">
                  <button type="submit" className="mb-order jb-apply">
                    Simpan profil
                  </button>
                  {saved && <span className="jb-applied">✓ Tersimpan</span>}
                </div>
              </form>
              <div className="sp-reset">
                <span className="sp-muted">Data demo (profil, lamaran, stempel) tersimpan di browser ini.</span>
                <button
                  type="button"
                  className="sp-danger"
                  onClick={() => {
                    if (confirm("Hapus semua data demo job fair di browser ini?")) onReset();
                  }}
                >
                  Hapus data demo
                </button>
              </div>
            </div>
          )}

          {tab === "applications" &&
            (applications.length === 0 ? (
              <p className="sp-empty">Belum ada lamaran. Datangi stand lalu pilih "Lamar kerja", atau buka banner lowongan.</p>
            ) : (
              <>
                <p className="sp-summary">
                  Kamu sudah melamar <b>{applications.length} posisi</b> di <b>{companies.size} perusahaan</b>
                  {invited ? (
                    <>
                      , <b>{invited}</b> mengundangmu interview 🎉
                    </>
                  ) : (
                    "."
                  )}
                </p>
                <ul className="sp-list">
                  {applications.map((a) => {
                    const b = boothOf(a.boothId);
                    return (
                      <li key={a.id} style={{ ["--c" as string]: b?.color ?? "#64748b" }}>
                        <span className="sp-logo">{b?.logo}</span>
                        <span className="sp-main">
                          <b>{a.jobTitle}</b>
                          <span className="sp-muted">
                            {a.company} · {when(a.at)}
                          </span>
                        </span>
                        <span className="status" data-status={a.status}>
                          {a.status}
                        </span>
                        <span className="sp-links">
                          <button type="button" onClick={() => onOpenJob(a.boothId, a.jobId)}>
                            Lowongan
                          </button>
                          <button type="button" onClick={() => onOpenCompany(a.boothId)}>
                            Perusahaan
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ))}

          {tab === "stamps" && (
            <>
              <p className="sp-summary">
                {visited.size === booths.length ? "Semua stand sudah kamu kunjungi! 🏆" : `Kunjungi semua stand untuk melengkapi kartu stempel (${visited.size}/${booths.length}).`}
              </p>
              <div className="sp-stamps">
                {booths.map((b) => {
                  const got = visited.has(b.id);
                  const n = applications.filter((a) => a.boothId === b.id).length;
                  return (
                    <button key={b.id} type="button" className="sp-stamp" data-got={got ? "" : undefined} style={{ ["--c" as string]: b.color }} onClick={() => onGoTo(b.id)} title={`Antar ke stand ${b.company}`}>
                      <span className="sp-stamp-mark">{got ? b.logo : "?"}</span>
                      <b>{b.company}</b>
                      <span className="sp-muted">{got ? (n ? `${n} lamaran` : "Sudah mampir") : "Belum dikunjungi"}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
