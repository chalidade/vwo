import { type FairNotif, NOTIF_ICON } from "../jobfair-engine";

const ago = (t: number) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "baru saja";
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

/** A list of notifications, newest first; unread ones are marked. */
export function NotifList({ items, onPick, empty }: { items: FairNotif[]; onPick: (n: FairNotif) => void; empty: string }) {
  if (!items.length) return <p className="nt-empty">{empty}</p>;
  return (
    <ul className="nt-list">
      {items.map((n) => (
        <li key={n.id}>
          <button type="button" className="nt-item" data-unread={n.read ? undefined : ""} onClick={() => onPick(n)}>
            <span className="nt-ico" data-kind={n.kind}>
              {NOTIF_ICON[n.kind]}
            </span>
            <span className="nt-main">
              <span className="nt-text">{n.text}</span>
              <span className="nt-time">{ago(n.at)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
