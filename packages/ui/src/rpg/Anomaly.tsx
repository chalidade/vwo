// Random anomalies on a floor (a cat, a puppy, fireflies, a lost balloon, a pigeon), drawn like the
// rest of the world: flat colours and thick dark outlines. They stroll a little to either side of
// their spot; tapped, they give a small sparkle and a coin pop before they leave.
import type { ReactElement } from "react";
import type { AnomalyKind } from "@vwo/shared";
import type { SceneExtra } from "./CafeScene";
import { INK } from "./Furniture";

const ink = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function Cat() {
  return (
    <svg width={44} height={38} viewBox="0 0 44 38" style={{ display: "block", overflow: "visible" }}>
      <path className="anom-tail" d="M8 26C2 22 2 12 7 10" fill="none" stroke={INK} strokeWidth={5.5} strokeLinecap="round" />
      <path className="anom-tail" d="M8 26C2 22 2 12 7 10" fill="none" stroke="#f59e0b" strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={20} cy={27} rx={13} ry={8} fill="#f59e0b" {...ink} />
      <path d="M14 22c2 3 2 7 0 10M20 21c2 3 2 8 0 12" fill="none" stroke="#c2410c" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M11 33v3M17 34v2.5M24 34v2.5M30 33v3" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <g className="anom-bob">
        <path d="M27 12l1-8 6 5ZM39 12l-1-8-6 5Z" fill="#f59e0b" {...ink} />
        <circle cx={33} cy={17} r={8} fill="#fbbf24" {...ink} />
        <circle cx={30} cy={16} r={1.3} fill={INK} />
        <circle cx={36} cy={16} r={1.3} fill={INK} />
        <path d="M32 19.5l1 0.8 1-0.8" fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
        <path d="M26 19h-4M40 19h4" stroke={INK} strokeWidth={0.9} />
      </g>
    </svg>
  );
}

function Dog() {
  return (
    <svg width={46} height={40} viewBox="0 0 46 40" style={{ display: "block", overflow: "visible" }}>
      <path className="anom-wag" d="M9 24l-6-7" stroke={INK} strokeWidth={5.5} strokeLinecap="round" />
      <path className="anom-wag" d="M9 24l-6-7" stroke="#d6a26b" strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={20} cy={28} rx={13} ry={8} fill="#d6a26b" {...ink} />
      <ellipse cx={18} cy={26} rx={5} ry={3.5} fill="#fff7ed" opacity={0.7} />
      <path d="M11 34v4M17 35v3M24 35v3M30 34v4" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <g className="anom-bob">
        <circle cx={34} cy={18} r={8.5} fill="#e8b980" {...ink} />
        <path d="M27 13c-4 2-5 8-2 11 2-2 3-6 2-11ZM41 13c4 2 5 8 2 11-2-2-3-6-2-11Z" fill="#8b5a2b" {...ink} />
        <ellipse cx={34} cy={22} rx={4} ry={3} fill="#fff7ed" {...ink} strokeWidth={1.2} />
        <circle cx={34} cy={20.6} r={1.3} fill={INK} />
        <circle cx={31} cy={16} r={1.3} fill={INK} />
        <circle cx={37} cy={16} r={1.3} fill={INK} />
        <path d="M34 24.5v1.5" stroke="#e11d48" strokeWidth={2} strokeLinecap="round" />
      </g>
    </svg>
  );
}

function Pigeon() {
  return (
    <svg width={40} height={36} viewBox="0 0 40 36" style={{ display: "block", overflow: "visible" }}>
      <path d="M6 22l-5 2 5 2Z" fill="#64748b" {...ink} strokeWidth={1.6} />
      <ellipse cx={18} cy={23} rx={12} ry={8} fill="#94a3b8" {...ink} />
      <path className="anom-flap" d="M12 19c4-3 10-3 13 2-5 2-10 2-13-2Z" fill="#cbd5e1" {...ink} strokeWidth={1.6} />
      <path d="M15 31l-1 4M21 31l1 4" stroke="#f97316" strokeWidth={2.4} strokeLinecap="round" />
      <g className="anom-peck">
        <path d="M26 20c0-3 0-6 2-8" fill="none" stroke="#0f766e" strokeWidth={5} strokeLinecap="round" opacity={0.8} />
        <circle cx={30} cy={11} r={5.5} fill="#64748b" {...ink} />
        <circle cx={31.5} cy={10} r={1.2} fill="#f97316" />
        <path d="M35 11l4 1.5-4 1Z" fill="#fbbf24" {...ink} strokeWidth={1.2} />
      </g>
    </svg>
  );
}

function Balloon() {
  return (
    <svg width={34} height={64} viewBox="0 0 34 64" style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={17} cy={61} rx={6} ry={2} fill="black" opacity={0.18} />
      <g className="anom-float">
        <path d="M17 30Q12 40 18 48T16 60" fill="none" stroke="#64748b" strokeWidth={1.2} />
        <ellipse cx={17} cy={15} rx={12} ry={14} fill="#ef4444" {...ink} />
        <path d="M14 29l3 3 3-3Z" fill="#b91c1c" {...ink} strokeWidth={1.4} />
        <ellipse cx={12} cy={9} rx={2.8} ry={4.5} fill="#fff" opacity={0.6} />
      </g>
    </svg>
  );
}

const FLIES = [
  [6, 10, 0],
  [20, 4, 0.6],
  [32, 14, 1.1],
  [12, 24, 1.7],
  [28, 28, 0.3],
  [38, 22, 2.1],
] as const;

function Fireflies() {
  return (
    <svg width={44} height={40} viewBox="0 0 44 40" style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={22} cy={22} rx={24} ry={20} fill="#fde047" opacity={0.18} />
      {FLIES.map(([x, y, d], i) => (
        <g key={i} className="anom-fly" style={{ animationDelay: `-${d}s` }}>
          <circle cx={x} cy={y} r={7} fill="#fef08a" opacity={0.45} />
          <circle cx={x} cy={y} r={3.2} fill="#fde047" stroke={INK} strokeWidth={1.2} />
        </g>
      ))}
    </svg>
  );
}

const SPRITES: Record<AnomalyKind, { node: () => ReactElement; w: number; h: number; turns: boolean }> = {
  cat: { node: Cat, w: 44, h: 38, turns: true },
  dog: { node: Dog, w: 46, h: 40, turns: true },
  pigeon: { node: Pigeon, w: 40, h: 36, turns: true },
  balloon: { node: Balloon, w: 34, h: 64, turns: false },
  fireflies: { node: Fireflies, w: 44, h: 40, turns: false },
};

/** One anomaly: strolling, or (claimed) a sparkle and the coins it gave. */
export function AnomalySprite({ kind, claimed }: { kind: AnomalyKind; claimed?: number }) {
  const s = SPRITES[kind];
  const Node = s.node;
  return (
    <div className="anom" data-claimed={claimed !== undefined ? "" : undefined} style={{ width: s.w, height: s.h }}>
      <div className="anom-wander">
        <div className={s.turns ? "anom-face" : undefined}>
          <Node />
        </div>
      </div>
      {claimed !== undefined && (
        <>
          <svg className="anom-burst" width={80} height={80} viewBox="-40 -40 80 80" aria-hidden>
            {Array.from({ length: 8 }, (_, i) => (
              <path key={i} d="M0 -14L3 -26L0 -34L-3 -26Z" fill={i % 2 ? "#facc15" : "#fb7185"} stroke={INK} strokeWidth={1} transform={`rotate(${i * 45})`} />
            ))}
          </svg>
          <div className="anom-pop">+{claimed}</div>
        </>
      )}
    </div>
  );
}

/** The scene piece for an anomaly standing at (x, y) in tiles. */
export function anomalyExtras(a: { id: string; kind: AnomalyKind; name: string; x: number; y: number; claimed?: number }, onClick?: () => void): SceneExtra[] {
  const s = SPRITES[a.kind];
  return [
    {
      key: `anomaly-${a.id}`,
      x: a.x - s.w / 96,
      y: a.y - s.h / 48,
      z: a.claimed === undefined ? a.y : a.y + 2,
      node: <AnomalySprite kind={a.kind} claimed={a.claimed} />,
      onClick: a.claimed === undefined ? onClick : undefined,
      title: a.name,
    },
  ];
}
