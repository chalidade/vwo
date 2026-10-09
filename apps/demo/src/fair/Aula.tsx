import { useState } from "react";
import type { FairStop } from "@vwo/shared";
import type { AulaEvent } from "../jobfair-engine";
import { fair } from "../useFair";
import { Modal } from "./Modal";

export type AulaTab = "jadwal" | "info" | "meet";

const KIND: Record<AulaEvent["kind"], string> = { sambutan: "🎙️ Sambutan", talkshow: "💬 Talkshow", hiburan: "🎸 Hiburan", doorprize: "🎁 Door prize", info: "ℹ️ Info" };

const FAQ = [
  { q: "Apakah job fair ini gratis?", a: "Gratis untuk pencari kerja. Koin hanya untuk fitur tambahan seperti ruang psikotes dan seminar." },
  { q: "Bagaimana cara melamar?", a: "Datangi stand perusahaan, buka banner lowongannya, lalu kirim lamaran. Status lamaran ada di menu Lamaran." },
  { q: "Kapan HR menghubungi saya?", a: "HR bisa membalas chat, menelepon, atau mengirim undangan interview. Semuanya muncul di lonceng notifikasi 🔔." },
  { q: "Di mana mendapat e-sertifikat seminar?", a: "Tonton seminar di Ruang Seminar sampai selesai, sertifikatnya masuk ke profilmu." },
];

/** The Aula's boards: today's rundown, the building and FAQ, and the meeting point. */
export function AulaBoard({ tab: start, stops, onClose, onGo }: { tab: AulaTab; stops: FairStop[]; onClose: () => void; onGo?: (s: FairStop) => void }) {
  const [tab, setTab] = useState<AulaTab>(start);
  const list = fair.rundown();
  const { current, next } = fair.aulaNow();
  return (
    <Modal title="🏛️ Aula Utama" onClose={onClose} className="au-board">
      <div className="au-tabs" role="tablist">
        {(
          [
            ["jadwal", "🗓️ Jadwal"],
            ["info", "ℹ️ Info & denah"],
            ["meet", "📍 Meeting point"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="au-tab" onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "jadwal" && (
        <>
          <p className="au-now">
            {current ? (
              <>
                <b>Sedang berlangsung:</b> {current.title} ({current.start}–{current.end})
              </>
            ) : next ? (
              <>
                <b>Berikutnya {next.start}:</b> {next.title}
              </>
            ) : (
              "Acara hari ini sudah selesai. Terima kasih sudah datang!"
            )}
          </p>
          <ol className="au-list">
            {list.map((e) => (
              <li key={e.id} data-on={current?.id === e.id ? "" : undefined}>
                <span className="au-time">
                  {e.start}
                  <small>{e.end}</small>
                </span>
                <span className="au-main">
                  <b>{e.title}</b>
                  <span>
                    {KIND[e.kind]} · {e.host}
                    {e.place ? ` · ${e.place}` : " · Panggung Aula"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      {tab === "info" && (
        <>
          <h4 className="au-h">Denah gedung</h4>
          <ul className="au-floors">
            {[...stops].reverse().map((s) => (
              <li key={s.floorId}>
                <span className="au-lv">{s.level + 1}</span>
                <span className="au-main">
                  <b>
                    {s.emoji} {s.label}
                  </b>
                  <span>{s.name}</span>
                </span>
                {onGo && (
                  <button type="button" className="rpg-btn au-go" onClick={() => onGo(s)}>
                    Ke sana
                  </button>
                )}
              </li>
            ))}
          </ul>
          <h4 className="au-h">Pertanyaan umum</h4>
          {FAQ.map((f) => (
            <details key={f.q} className="au-faq">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
          <h4 className="au-h">Kontak panitia</h4>
          <p className="au-contact">
            Meja Informasi di Lantai 2 dekat lift · <a href="mailto:panitia@vwo.example">panitia@vwo.example</a>
          </p>
        </>
      )}
      {tab === "meet" && (
        <div className="au-meet">
          <div className="au-meet-pin">📍</div>
          <p>
            <b>Meeting point</b> ada di pojok kiri bawah Aula, ditandai lingkaran hijau dan tiang <b>MEETING POINT</b>.
          </p>
          <p>Janjian dengan teman, menunggu giliran interview, atau berkumpul sebelum talkshow dimulai di sini. Panitia juga mengumumkan pemenang door prize di titik ini.</p>
        </div>
      )}
    </Modal>
  );
}
