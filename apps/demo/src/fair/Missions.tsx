import { MISSIONS_BONUS, type Mission } from "./content";
import { Modal } from "./Modal";

type MissionView = Mission & { progress: number; claimed: boolean };

/** Today's missions: small goals that pay coins and XP, plus a bonus for doing them all. */
export function MissionsPanel({
  missions,
  bonusClaimed,
  streak,
  canClaimDaily,
  onClaim,
  onBonus,
  onDaily,
  onClose,
}: {
  missions: MissionView[];
  bonusClaimed: boolean;
  streak: number;
  canClaimDaily: boolean;
  onClaim: (id: string) => void;
  onBonus: () => void;
  onDaily: () => void;
  onClose: () => void;
}) {
  const all = missions.every((m) => m.claimed);
  return (
    <Modal title="🎯 Misi hari ini" onClose={onClose} className="fx-missions">
      <div className="fx-daily">
        <span>
          🔥 Beruntun <b>{streak}</b> hari · koin harian makin besar tiap hari datang
        </span>
        <button type="button" className="mb-order" disabled={!canClaimDaily} onClick={onDaily}>
          {canClaimDaily ? "Klaim koin harian" : "Sudah diklaim"}
        </button>
      </div>
      <ul className="ms-list">
        {missions.map((m) => {
          const done = m.progress >= m.target;
          return (
            <li key={m.id} data-done={done ? "" : undefined} data-claimed={m.claimed ? "" : undefined}>
              <span className="ms-main">
                <b>{m.title}</b>
                <span className="fx-bar">
                  <span style={{ width: `${(m.progress / m.target) * 100}%` }} />
                </span>
                <span className="sp-muted">
                  {m.progress}/{m.target} · +{m.coins} 🪙 · +{m.xp} XP
                </span>
              </span>
              {m.claimed ? (
                <span className="fx-state">✓ Diklaim</span>
              ) : done ? (
                <button type="button" className="mb-order" onClick={() => onClaim(m.id)}>
                  Klaim
                </button>
              ) : (
                <span className="ms-todo">Belum</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="fx-callout" data-ready={all && !bonusClaimed ? "" : undefined}>
        <span>🏆 Selesaikan semua misi: bonus {MISSIONS_BONUS} koin</span>
        <button type="button" className="mb-order" disabled={!all || bonusClaimed} onClick={onBonus}>
          {bonusClaimed ? "✓ Diklaim" : "Klaim bonus"}
        </button>
      </div>
      <p className="sp-muted">Misi berganti tiap hari. Main mini game dengan duduk di sofa lounge.</p>
    </Modal>
  );
}
