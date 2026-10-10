// Quick messages from other job seekers, shown as cards at the top of the screen with the sender's
// face, so a "follow me" or "come to floor 3" meant for this player is hard to miss.
import { type Look, Person } from "@vwo/ui";

export interface PingAction {
  label: string;
  onPick: () => void;
  /** The main answer, drawn in the accent colour. */
  primary?: boolean;
}

export interface PingCardView {
  id: number;
  name: string;
  look?: Look;
  text: string;
  /** Where the sender is, e.g. "Lantai 2 · Seminar". */
  where?: string;
  actions: PingAction[];
}

export function PingCards({ items, onClose }: { items: PingCardView[]; onClose: (id: number) => void }) {
  if (!items.length) return null;
  return (
    <div className="pings" onPointerDown={(e) => e.stopPropagation()} role="log" aria-live="polite">
      {items.map((p) => (
        <div key={p.id} className="ping rpg-box">
          <div className="ping-face" aria-hidden>
            {p.look ? <Person look={p.look} size={1.05} /> : "🙂"}
          </div>
          <div className="ping-main">
            <div className="ping-head">
              <b>{p.name}</b>
              {p.where && <span className="ping-where">{p.where}</span>}
            </div>
            <div className="ping-text">{p.text}</div>
            {p.actions.length > 0 && (
              <div className="ping-actions">
                {p.actions.map((a) => (
                  <button key={a.label} type="button" data-primary={a.primary ? "" : undefined} onClick={a.onPick}>
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="ping-x" onClick={() => onClose(p.id)} aria-label="Tutup">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

/** The bar shown while the player walks after someone. */
export function FollowBar({ name, where, onStop }: { name: string; where?: string; onStop: () => void }) {
  return (
    <div className="follow-bar rpg-box" onPointerDown={(e) => e.stopPropagation()}>
      <span>
        👣 Mengikuti <b>{name}</b>
        {where && <span className="ping-where"> · {where}</span>}
      </span>
      <button type="button" onClick={onStop}>
        Berhenti
      </button>
    </div>
  );
}
