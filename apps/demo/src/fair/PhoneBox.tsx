// The phone box in the park: pick a friend, how long and voice or video, and it rings them through
// the same call as the lounge (the same price as calling another job seeker there).
import { useState } from "react";
import { loungePlans } from "../jobfair-engine";
import type { CallKind } from "./call";
import type { LoungeCallStart } from "./Lounge";
import { Modal } from "./Modal";
import type { PhoneEntry } from "./phone-book";

export function PhoneBox({
  book,
  coins,
  canCall,
  onStart,
  onFriends,
  onTopUp,
  onClose,
}: {
  book: PhoneEntry[];
  coins: number;
  /** This browser can make calls at all. */
  canCall: boolean;
  onStart: (c: LoungeCallStart) => void;
  onFriends: () => void;
  onTopUp: () => void;
  onClose: () => void;
}) {
  const [tag, setTag] = useState(book.find((e) => e.online)?.tag);
  const [minutes, setMinutes] = useState<number>(loungePlans()[0]!.minutes);
  const [kind, setKind] = useState<CallKind>("voice");
  const plan = loungePlans().find((p) => p.minutes === minutes) ?? loungePlans()[0]!;
  const picked = book.find((e) => e.tag === tag && e.online);
  const online = book.filter((e) => e.online).length;

  return (
    <Modal title="☎️ Telepon umum" onClose={onClose} className="lg pb">
      <p className="lg-lead">Telepon teman yang sedang di job fair. Tarifnya sama dengan telepon sesama pelamar di lounge.</p>
      {book.length === 0 ? (
        <div className="pb-empty">
          <p className="lg-lead">Belum ada teman untuk ditelepon. Ketuk pelamar lain, lalu pilih ⭐ Simpan jadi teman.</p>
          <button type="button" className="lg-opt" onClick={onFriends}>
            <b>👥 Buka daftar teman</b>
          </button>
        </div>
      ) : (
        <>
          <div className="lg-label">
            Teman ({online} online dari {book.length})
          </div>
          <ul className="fr-list pb-list" role="radiogroup" aria-label="Pilih teman">
            {book.map((e) => (
              <li key={e.tag} data-off={e.online ? undefined : ""}>
                <span className="fr-dot" data-on={e.online ? "" : undefined} />
                <span className="fr-who">
                  <b>{e.name}</b>
                  <span>{e.online ? e.online.where : "Sedang offline, tidak bisa ditelepon"}</span>
                </span>
                <span className="fr-acts">
                  <button type="button" role="radio" aria-checked={tag === e.tag} data-primary={tag === e.tag ? "" : undefined} disabled={!e.online} onClick={() => setTag(e.tag)}>
                    {e.online ? (tag === e.tag ? "✓ Dipilih" : "Pilih") : "Offline"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {online > 0 && (
        <>
          <div className="lg-label">Durasi</div>
          <div className="lg-options">
            {loungePlans().map((p) => (
              <button key={p.minutes} type="button" className="lg-opt" data-active={minutes === p.minutes ? "" : undefined} onClick={() => setMinutes(p.minutes)}>
                <b>{p.minutes} menit</b>
                <span>{p.coins} 🪙</span>
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
          {!canCall ? (
            <button type="button" className="mb-order lg-go" disabled>
              Browser ini belum bisa melakukan panggilan
            </button>
          ) : coins >= plan.coins ? (
            <button
              type="button"
              className="mb-order lg-go"
              disabled={!picked}
              onClick={() => picked?.online && onStart({ kind, minutes, peer: { memberId: picked.online.memberId, name: picked.name } })}
            >
              {picked ? `Telepon ${picked.name} · ${plan.coins} 🪙` : "Pilih teman yang online"}
            </button>
          ) : (
            <button type="button" className="mb-order lg-go" onClick={onTopUp}>
              Koin kurang, isi koin dulu
            </button>
          )}
        </>
      )}
      {book.length > 0 && online === 0 && <p className="lg-note pb-off">Semua temanmu sedang offline. Coba lagi nanti, atau ajak mereka masuk job fair.</p>}
    </Modal>
  );
}
