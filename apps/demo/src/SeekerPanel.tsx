import { useState } from "react";
import type { CompanyBooth, FairFloorInfo } from "@vwo/shared";
import { type Look, Person } from "@vwo/ui";
import { SEEKER_TITLES, levelOf } from "./fair/content";
import { fair } from "./useFair";
import { LevelBar, Stars } from "./fair/Modal";
import type { FairApplication, PlayerState } from "./jobfair-engine";
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
  floors,
  player,
  companyRating,
  visited,
  onSaveProfile,
  onReply,
  onOpenJob,
  onOpenCompany,
  onGoTo,
  onReset,
  onVerify,
  onClose,
}: {
  tab?: SeekerTab;
  look: Look;
  profile: SeekerProfile;
  applications: FairApplication[];
  booths: CompanyBooth[];
  floors: FairFloorInfo[];
  player: PlayerState;
  companyRating: (boothId: string) => { average: number; count: number };
  visited: Set<string>;
  onSaveProfile: (p: SeekerProfile) => void;
  onReply: (applicationId: string, text: string) => void;
  onOpenJob: (boothId: string, jobId: string) => void;
  onOpenCompany: (boothId: string) => void;
  onGoTo: (boothId: string) => void;
  onReset: () => void;
  onVerify: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<SeekerTab>(startTab);
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);
  const companies = new Set(applications.map((a) => a.boothId));
  const invited = applications.filter((a) => a.status === "Diundang interview").length;
  const boothOf = (id: string) => booths.find((b) => b.id === id);
  const lv = levelOf(player.xp);
  const best = player.psych.reduce<number | null>((m, r) => Math.max(m ?? 0, Math.round((r.score / r.total) * 100)), null);
  const rated = applications.filter((a) => a.rating);
  const avgRating = rated.length ? rated.reduce((n, a) => n + a.rating!, 0) / rated.length : null;

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
                  <div className="sp-name">
                    {profile.name || "Tanpa nama"}
                    {player.verified && <span className="rpg-check vf-check">✔</span>}
                  </div>
                  <div className="sp-muted">{profile.headline || "Lengkapi profilmu supaya form lamaran terisi otomatis."}</div>
                </div>
              </div>
              {!player.verified && (
                <div className="sp-verify">
                  <span>Dapatkan centang biru supaya profilmu lebih dipercaya.</span>
                  <button type="button" className="mb-order vf-buy" onClick={onVerify}>
                    ✔ Verified
                  </button>
                </div>
              )}
              <LevelBar level={lv.level} title={SEEKER_TITLES[lv.level - 1]!} progress={lv.progress} xp={player.xp} next={lv.to} />
              <div className="sp-stats">
                {(
                  [
                    [applications.length, "lamaran"],
                    [companies.size, "perusahaan"],
                    [invited, "undangan interview"],
                    [visited.size, "stand dikunjungi"],
                    [avgRating ? `★${avgRating.toFixed(1)}` : "–", "rating dari perusahaan"],
                    [best != null ? best : "–", "nilai psikotes terbaik"],
                    [`${player.seminars.length}/${fair.seminars().length}`, "sertifikat seminar"],
                    [player.coins, "koin"],
                  ] as const
                ).map(([n, label]) => (
                  <div key={label} className="sp-stat">
                    <b>{n}</b>
                    <span>{label}</span>
                  </div>
                ))}
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
                            {a.company}
                            {b ? ` · ${floors[b.floor]?.name ?? ""}` : ""} · {when(a.at)}
                          </span>
                        </span>
                        <span className="status" data-status={a.status}>
                          {a.status}
                        </span>
                        {a.rating ? (
                          <span className="sp-rating">
                            <Stars value={a.rating} /> {a.feedback}
                          </span>
                        ) : (
                          <span className="sp-rating sp-muted">Menunggu penilaian perusahaan…</span>
                        )}
                        {a.interview && (
                          <span className="sp-interview">
                            📅 Interview {a.interview.mode} · <b>{new Date(a.interview.at).toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b>
                            {a.interview.place ? ` · ${a.interview.place}` : ""}
                          </span>
                        )}
                        {(a.calls ?? []).some((c) => !c.answered) && <span className="sp-missed">📞 {a.company} mencoba menelepon kamu</span>}
                        {(a.messages ?? []).length > 0 && <Chat app={a} onReply={onReply} />}
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
              {floors.map((f, i) => {
                const here = booths.filter((b) => b.floor === i);
                const got = here.filter((b) => visited.has(b.id)).length;
                return (
                  <section key={f.name} className="sp-floor">
                    <h4 className="sp-floor-title">
                      {f.name} · {f.theme} <span className="sp-muted">{got}/{here.length}</span>
                    </h4>
                    <div className="sp-stamps">
                      {here.map((b) => {
                        const got = visited.has(b.id);
                        const n = applications.filter((a) => a.boothId === b.id).length;
                        return (
                          <button key={b.id} type="button" className="sp-stamp" data-got={got ? "" : undefined} style={{ ["--c" as string]: b.color }} onClick={() => onGoTo(b.id)} title={`Antar ke stand ${b.company}`}>
                            <span className="sp-stamp-mark">{got ? b.logo : "?"}</span>
                            <b>{b.company}</b>
                            <Stars value={companyRating(b.id).average} />
                            <span className="sp-muted">{got ? (n ? `${n} lamaran` : "Sudah mampir") : "Belum dikunjungi"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Messages from the company about one application, with a reply box. */
function Chat({ app, onReply }: { app: FairApplication; onReply: (applicationId: string, text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="sp-chat">
      {app.messages!.map((m, i) => (
        <div key={i} className="sp-bubble" data-me={m.from === "seeker" ? "" : undefined}>
          {m.text}
        </div>
      ))}
      <form
        className="sp-reply"
        onSubmit={(e) => {
          e.preventDefault();
          onReply(app.id, text);
          setText("");
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Balas ${app.company}`} maxLength={600} aria-label={`Balas ${app.company}`} />
        <button type="submit" disabled={!text.trim()}>
          Kirim
        </button>
      </form>
    </div>
  );
}
