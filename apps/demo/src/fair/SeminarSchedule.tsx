import { useEffect, useState } from "react";
import { cleanSchedule, registerBlock, seminarPhase, seminarWhen, sortByStart } from "@vwo/shared";
import { useFair } from "../useFair";
import { calendarHref } from "./calendar";
import type { SeminarSession } from "./content";
import { pullSeminarRegs, setSeminarReg } from "./seminar-reg";

/** A session with its schedule fields cleaned the way the server reads them. */
const timed = (s: SeminarSession) => ({ ...s, ...cleanSchedule(s) });

/**
 * The seminar programme by date and time, for seekers: register ("Daftar") or cancel ("Batal"), save to
 * the calendar, and see the seats left. Sessions without a date still show, as "Jadwal belum ditentukan".
 * `onWatch` adds a button to watch a session now (in the seminar room).
 */
export function SeminarSchedule({ onWatch }: { onWatch?: (s: SeminarSession) => void }) {
  const fair = useFair();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => void pullSeminarRegs(true), []);
  const now = Date.now();
  const mine = new Set(fair.seminarRegs());
  const list = sortByStart(fair.seminars().map(timed));

  const toggle = (id: string, register: boolean) => {
    setBusy(id);
    void setSeminarReg(id, register).then((r) => {
      setBusy(null);
      setMsg(r);
    });
  };

  return (
    <>
      {msg && (
        <p className="sem-msg" data-error={msg.ok ? undefined : ""} role="status">
          {msg.text}
        </p>
      )}
      <ul className="sem-list">
        {list.map((s) => {
          const phase = seminarPhase(s, now);
          const on = mine.has(s.id);
          const count = fair.seminarRegCount(s.id);
          const block = on ? null : registerBlock(s, count, now);
          return (
            <li key={s.id} data-on={on ? "" : undefined} data-phase={phase}>
              <span className="sem-main">
                <b>{s.title}</b>
                <span className="sp-muted">
                  {s.speaker}
                  {s.role ? `, ${s.role}` : ""}
                </span>
                <span className="sem-when">
                  {phase === "live" && <span className="sem-live">● LIVE</span>}
                  {phase === "ended" && <span className="sem-tag">Selesai</span>}
                  {seminarWhen(s)}
                </span>
                {phase !== "unscheduled" && (
                  <span className="sp-muted">
                    {s.capacity ? `${count}/${s.capacity} kursi terisi${count >= s.capacity ? " · penuh" : ""}` : `${count} terdaftar`}
                    {on ? " · ✓ kamu terdaftar" : ""}
                  </span>
                )}
              </span>
              <span className="sem-tools">
                {onWatch && (
                  <button type="button" className="small-btn ghost" onClick={() => onWatch(s)}>
                    {phase === "live" ? "Tonton" : fair.player.seminars.includes(s.id) ? "✓ Ulangi" : "Putar"}
                  </button>
                )}
                {phase !== "unscheduled" && phase !== "ended" && (
                  <button
                    type="button"
                    className="small-btn"
                    data-on={on ? "" : undefined}
                    disabled={busy === s.id || !!block}
                    aria-pressed={on}
                    onClick={() => toggle(s.id, !on)}
                    title={block === "full" ? "Kursi sudah penuh" : on ? "Batalkan pendaftaran" : "Daftar dan dapat pengingat"}
                  >
                    {on ? "Batal" : block === "full" ? "Penuh" : "Daftar"}
                  </button>
                )}
                {on && s.startAt !== undefined && phase !== "ended" && (
                  <a
                    className="small-btn ghost"
                    href={calendarHref({
                      uid: `seminar-${s.id}-${s.startAt}`,
                      at: s.startAt,
                      minutes: s.minutes,
                      summary: `Seminar: ${s.title}`,
                      location: "Ruang Seminar · jobfair.co.id",
                      description: `${s.speaker}${s.role ? `, ${s.role}` : ""}`,
                    })}
                    download={`seminar-${s.id}.ics`}
                    aria-label={`Simpan ${s.title} ke kalender`}
                    title="Simpan ke kalender"
                  >
                    🗓️
                  </a>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
