import type { FairApplication } from "../jobfair-engine";
import { BoothLogo } from "@vwo/ui";
import { fair } from "../useFair";
import { Modal } from "./Modal";

const ics = (t: number) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** A calendar file for the interview, so the applicant can keep it in their own calendar. */
function calendarHref(a: FairApplication) {
  const iv = a.interview!;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VWO Job Fair//ID",
    "BEGIN:VEVENT",
    `UID:${a.id}@vwo.example`,
    `DTSTAMP:${ics(Date.now())}`,
    `DTSTART:${ics(iv.at)}`,
    `DTEND:${ics(iv.at + 45 * 60_000)}`,
    `SUMMARY:Interview ${a.jobTitle} · ${a.company}`,
    `LOCATION:${(iv.place || iv.mode).replace(/[,;]/g, " ")}`,
    `DESCRIPTION:${(iv.note || `Interview via ${iv.mode}`).replace(/[,;\n]/g, " ")}`,
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
