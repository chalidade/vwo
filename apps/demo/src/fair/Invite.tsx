import type { FairApplication } from "../jobfair-engine";
import { BoothLogo } from "@vwo/ui";
import { fair } from "../useFair";
import { Modal } from "./Modal";

const ics = (t: number) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** A calendar file for the interview, so the applicant can keep it in their own calendar. */
function calendarHref(a: FairApplication) {
  const iv = a.interview!;
  return calendarFile(a, iv.at, `Interview ${a.jobTitle} · ${a.company}`, iv.place || iv.mode, iv.note || `Interview via ${iv.mode}`);
}

function calendarFile(a: FairApplication, at: number, summary: string, location: string, description: string) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//jobfair//ID",
    "BEGIN:VEVENT",
    `UID:${a.id}@vwo.example`,
    `DTSTAMP:${ics(Date.now())}`,
    `DTSTART:${ics(at)}`,
    `DTEND:${ics(at + 45 * 60_000)}`,
    `SUMMARY:${summary.replace(/[,;\n]/g, " ")}`,
    `LOCATION:${location.replace(/[,;\n]/g, " ")}`,
    `DESCRIPTION:${description.replace(/[,;\n]/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

/** The invitation the applicant sees when a company schedules (or moves) an interview. */
export function InviteCard({ application: a, onOpen, onClose }: { application: FairApplication; onOpen: () => void; onClose: () => void }) {
  const iv = a.interview;
  const b = fair.booth(a.boothId);
  if (!iv) return null;
  const when = new Date(iv.at);
  const online = /video|call|telepon|online/i.test(iv.mode);
  return (
    <Modal title="📅 Undangan interview" onClose={onClose} className="iv-card">
      <div className="iv-head" style={{ ["--c" as string]: b?.color ?? "#2563eb" }}>
        {b ? <BoothLogo booth={b} className="iv-logo" /> : <span className="iv-logo">{a.company.slice(0, 2)}</span>}
        <span>
          <b>{a.company}</b>
          <span className="sp-muted">mengundangmu interview untuk {a.jobTitle}</span>
        </span>
      </div>
      <div className="iv-when">
        <span className="iv-date">
          <b>{when.toLocaleDateString("id-ID", { day: "numeric" })}</b>
          {when.toLocaleDateString("id-ID", { month: "short" })}
        </span>
        <span>
          <b>{when.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</b>
          <span className="sp-muted">
            Pukul {when.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · {online ? "🎥" : "📍"} {iv.mode}
          </span>
        </span>
      </div>
      {iv.place && (
        <p className="iv-line">
          {online ? "🔗" : "📍"} {iv.place}
        </p>
      )}
      {iv.note && <p className="iv-line iv-note">“{iv.note}”</p>}
      <p className="sp-muted iv-tip">{online ? "Saat jadwalnya tiba, recruiter akan menelepon kamu di sini. Pastikan halaman ini tetap terbuka." : "Datang 10 menit lebih awal dan bawa CV."}</p>
      <div className="iv-reply">
        {iv.reply === "hadir" ? (
          <span className="iv-replied">✅ Kamu sudah konfirmasi hadir. HR mendapat notifikasinya.</span>
        ) : iv.reply === "jadwal-ulang" ? (
          <span className="iv-replied">🕑 Kamu minta jadwal ulang. Tunggu HR mengirim jadwal baru.</span>
        ) : (
          <>
            <button type="button" className="small-btn" onClick={() => fair.answerInterview(a.id, "hadir")}>
              ✅ Konfirmasi hadir
            </button>
            <button type="button" className="small-btn ghost" onClick={() => fair.answerInterview(a.id, "jadwal-ulang")}>
              🕑 Minta jadwal ulang
            </button>
          </>
        )}
      </div>
      <div className="iv-actions">
        <a className="small-btn ghost" href={calendarHref(a)} download={`interview-${a.company}.ics`}>
          🗓️ Simpan ke kalender
        </a>
        <button type="button" className="mb-order jb-apply" onClick={onOpen}>
          Lihat lamaran & chat
        </button>
      </div>
    </Modal>
  );
}

/** The invitation the applicant sees when a company, after a passed interview, invites them to its office. */
export function VisitCard({ application: a, onOpen, onClose }: { application: FairApplication; onOpen: () => void; onClose: () => void }) {
  const v = a.visit;
  const b = fair.booth(a.boothId);
  if (!v) return null;
  const when = new Date(v.at);
  return (
    <Modal title="🏢 Undangan kunjungan kantor" onClose={onClose} className="iv-card">
      <div className="iv-head" style={{ ["--c" as string]: b?.color ?? "#2563eb" }}>
        {b ? <BoothLogo booth={b} className="iv-logo" /> : <span className="iv-logo">{a.company.slice(0, 2)}</span>}
        <span>
          <b>{a.company}</b>
          <span className="sp-muted">🎉 Kamu lolos interview {a.jobTitle}! Yuk berkunjung ke kantor.</span>
        </span>
      </div>
      <div className="iv-when">
        <span className="iv-date">
          <b>{when.toLocaleDateString("id-ID", { day: "numeric" })}</b>
          {when.toLocaleDateString("id-ID", { month: "short" })}
        </span>
        <span>
          <b>{when.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</b>
          <span className="sp-muted">Pukul {when.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
        </span>
      </div>
      <p className="iv-line">
        📍 {v.address}{" "}
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.address)}`} target="_blank" rel="noopener noreferrer">
          Buka peta ↗
        </a>
      </p>
      {v.note && <p className="iv-line iv-note">“{v.note}”</p>}
      <p className="sp-muted iv-tip">Datang 15 menit lebih awal, berpakaian rapi, dan bawa CV serta KTP.</p>
      <div className="iv-reply">
        {v.reply === "hadir" ? (
          <span className="iv-replied">✅ Kamu sudah konfirmasi hadir. HR mendapat notifikasinya.</span>
        ) : v.reply === "jadwal-ulang" ? (
          <span className="iv-replied">🕑 Kamu minta jadwal ulang. Tunggu HR mengirim jadwal baru.</span>
        ) : (
          <>
            <button type="button" className="small-btn" onClick={() => fair.answerVisit(a.id, "hadir")}>
              ✅ Konfirmasi hadir
            </button>
            <button type="button" className="small-btn ghost" onClick={() => fair.answerVisit(a.id, "jadwal-ulang")}>
              🕑 Minta jadwal ulang
            </button>
          </>
        )}
      </div>
      <div className="iv-actions">
        <a className="small-btn ghost" href={calendarFile(a, v.at, `Kunjungan kantor ${a.company}`, v.address, v.note || `Kunjungan kantor setelah interview ${a.jobTitle}`)} download={`kunjungan-${a.company}.ics`}>
          🗓️ Simpan ke kalender
        </a>
        <button type="button" className="mb-order jb-apply" onClick={onOpen}>
          Lihat lamaran & chat
        </button>
      </div>
    </Modal>
  );
}
