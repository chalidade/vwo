import { useState } from "react";
import type { Consultant } from "@vwo/shared";
import { loungePlans } from "../jobfair-engine";
import type { CallKind } from "./call";
import { Modal } from "./Modal";

export type LoungeView = { mode: "consult"; index: number } | { mode: "peer"; memberId?: string } | { mode: "info" };

/** Someone on the lounge floor the job seeker can call. */
export interface LoungePeer {
  memberId: string;
  name: string;
}

export interface LoungeCallStart {
  kind: CallKind;
  minutes: number;
  consultant?: Consultant;
  peer?: LoungePeer;
}

/** Things to talk about when calling another job seeker (a bot, in the demo). */
export const PEER_LINES = [
  "Halo! Iya, aku yang duduk di sofa sebelah 😄",
  "Kamu sudah melamar ke mana saja? Aku baru ke dua stand.",
  "Tadi aku konsultasi sama Kak Maya, tipsnya bagus banget soal portofolio.",
  "Psikotes di lantai 7 lumayan susah, latihan deret angka dulu ya.",
  "Nanti kita ketemu di meeting point Aula pas undian door prize yuk!",
  "Semangat ya, semoga kita sama-sama dapat panggilan interview 🙏",
];

/** The consultation lounge: pick a consultant or someone to call, how long, and voice or video.
 *  Each call is paid up front and stops by itself when its time is up. */
export function LoungeDesk({
  view,
  consultants,
  peers,
  coins,
  onStart,
  onTopUp,
  onClose,
}: {
  view: LoungeView;
  consultants: Consultant[];
  peers: LoungePeer[];
  coins: number;
  onStart: (c: LoungeCallStart) => void;
  onTopUp: () => void;
  onClose: () => void;
}) {
  const [minutes, setMinutes] = useState<number>(loungePlans()[0]!.minutes);
  const [kind, setKind] = useState<CallKind>("voice");
  const [peerId, setPeerId] = useState(view.mode === "peer" ? (view.memberId ?? peers[0]?.memberId) : undefined);
  const consult = view.mode === "consult" ? consultants[view.index] : undefined;
  const plan = loungePlans().find((p) => p.minutes === minutes) ?? loungePlans()[0]!;
  const price = consult ? plan.consultCoins : plan.coins;
  const peer = peers.find((p) => p.memberId === peerId);

  if (view.mode === "info")
    return (
      <Modal title="📞 Lounge Konsultasi" onClose={onClose} className="lg">
        <p className="lg-lead">Duduk santai di sofa, lalu telepon HR, konsultan karier, atau sesama pencari kerja.</p>
        <table className="lg-prices">
          <thead>
            <tr>
              <th>Durasi</th>
              <th>Konsultan</th>
              <th>Sesama pelamar</th>
            </tr>
          </thead>
          <tbody>
            {loungePlans().map((p) => (
              <tr key={p.minutes}>
                <td>{p.minutes} menit</td>
                <td>{p.consultCoins} 🪙</td>
                <td>{p.coins} 🪙</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="lg-rules">
          <li>Koin dipotong saat panggilan dimulai.</li>
          <li>Sisa waktu terlihat di layar, dan panggilan berhenti otomatis saat waktunya habis.</li>
          <li>Pilih telepon (suara saja) atau video call.</li>
          <li>Konsultan ada di meja belakang. Untuk menelepon sesama pelamar, dekati orangnya atau duduk di sofa.</li>
        </ul>
      </Modal>
    );

  return (
    <Modal title={consult ? `📞 Konsultasi dengan ${consult.name}` : "📞 Telepon sesama pelamar"} onClose={onClose} className="lg">
      {consult ? (
        <div className="lg-card" style={{ ["--c" as string]: consult.color }}>
          <span className="lg-emoji">{consult.emoji}</span>
          <div>
            <b>{consult.name}</b>
            <span className="muted small">
              {consult.role}
              {consult.org ? ` · ${consult.org}` : ""}
            </span>
            <div className="lg-topics">
              {consult.topics.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      ) : peers.length ? (
        <label className="lg-field">
          Telepon siapa?
          <select value={peerId} onChange={(e) => setPeerId(e.target.value)}>
            {peers.map((p) => (
              <option key={p.memberId} value={p.memberId}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="lg-lead">Belum ada orang lain di lounge. Tunggu sebentar sampai ada yang duduk di sofa.</p>
      )}

      <div className="lg-label">Durasi</div>
      <div className="lg-options">
        {loungePlans().map((p) => (
          <button key={p.minutes} type="button" className="lg-opt" data-active={minutes === p.minutes ? "" : undefined} onClick={() => setMinutes(p.minutes)}>
            <b>{p.minutes} menit</b>
            <span>{consult ? p.consultCoins : p.coins} 🪙</span>
          </button>
        ))}
      </div>
      <div className="lg-label">Jenis panggilan</div>
      <div className="lg-options">
        {(
          [
            ["voice", "📞 Telepon"],
            ["video", "🎥 Video call"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" className="lg-opt" data-active={kind === k ? "" : undefined} onClick={() => setKind(k)}>
            <b>{label}</b>
          </button>
        ))}
      </div>
      <p className="lg-note">
        Saldo kamu {coins} 🪙. Panggilan berhenti otomatis setelah {minutes} menit.
      </p>
      {coins >= price ? (
        <button
          type="button"
          className="mb-order lg-go"
          disabled={!consult && !peer}
          onClick={() => onStart({ kind, minutes, consultant: consult, peer: consult ? undefined : peer })}
        >
          Mulai {kind === "video" ? "video call" : "telepon"} · {price} 🪙
        </button>
      ) : (
        <button type="button" className="mb-order lg-go" onClick={onTopUp}>
          Koin kurang, isi koin dulu
        </button>
      )}
    </Modal>
  );
}
