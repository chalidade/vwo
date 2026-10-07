import { type ReactNode, useEffect } from "react";

/** A popup in the game's style. Escape or a click outside closes it. */
export function Modal({ title, onClose, children, className, foot }: { title: ReactNode; onClose: () => void; children: ReactNode; className?: string; foot?: ReactNode }) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Escape") onClose();
      else if ((e.target as HTMLElement)?.tagName !== "INPUT") e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  });
  return (
    <div className="mb-backdrop" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
      <div className={`rpg-box mb ${className ?? ""}`} role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="mb-head">
          <span className="mb-title">{title}</span>
          <button type="button" className="mb-close" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="mb-page fx-page">{children}</div>
        {foot && <div className="mb-nav">{foot}</div>}
      </div>
    </div>
  );
}

/** Read-only stars, e.g. ★★★★☆ 4.2 */
export function Stars({ value, count }: { value: number; count?: number }) {
  const full = Math.round(value);
  return (
    <span className="fx-stars" title={`${value.toFixed(1)} dari 5`}>
      <span className="fx-stars-on">{"★".repeat(full)}</span>
      <span className="fx-stars-off">{"★".repeat(5 - full)}</span>
      {count != null && (
        <span className="fx-stars-n">
          {" "}
          {value.toFixed(1)} ({count})
        </span>
      )}
    </span>
  );
}

/** A level badge with an XP bar. */
export function LevelBar({ level, title, progress, xp, next, compact }: { level: number; title: string; progress: number; xp: number; next: number | null; compact?: boolean }) {
  return (
    <div className="fx-level" data-compact={compact ? "" : undefined}>
      <span className="fx-lv">Lv {level}</span>
      <span className="fx-level-main">
        <span className="fx-level-title">{title}</span>
        <span className="fx-bar">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
        {!compact && <span className="fx-xp">{next ? `${xp} / ${next} XP` : `${xp} XP · level maksimal`}</span>}
      </span>
    </div>
  );
}
