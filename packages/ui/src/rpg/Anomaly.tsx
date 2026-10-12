// Random anomalies on a floor (a cat, a puppy, fireflies, a rubber duck, a little ghost, a rare golden
// cat or dragon...), drawn like the rest of the world: flat colours and thick dark outlines. They
// stroll a little to either side of their spot, each with a small idle move; the rare ones glint.
// Tapped, they give a small sparkle and a coin pop before they leave.
import type { ReactElement } from "react";
import type { AnomalyKind } from "@vwo/shared";
import type { SceneExtra } from "./CafeScene";
import { INK } from "./Furniture";

const ink = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

const CAT_COATS = {
  cat: { fur: "#f59e0b", face: "#fbbf24", stripe: "#c2410c", eye: INK },
  blackcat: { fur: "#27272a", face: "#3f3f46", stripe: undefined, eye: "#facc15" },
  goldcat: { fur: "#eab308", face: "#fde047", stripe: "#a16207", eye: INK },
} as const;

function catOf(coat: keyof typeof CAT_COATS) {
  const c = CAT_COATS[coat];
  return function Cat() {
    return (
      <svg width={44} height={38} viewBox="0 0 44 38" style={{ display: "block", overflow: "visible" }}>
        <path className="anom-tail" d="M8 26C2 22 2 12 7 10" fill="none" stroke={INK} strokeWidth={5.5} strokeLinecap="round" />
        <path className="anom-tail" d="M8 26C2 22 2 12 7 10" fill="none" stroke={c.fur} strokeWidth={3} strokeLinecap="round" />
        <ellipse cx={20} cy={27} rx={13} ry={8} fill={c.fur} {...ink} />
        {c.stripe && <path d="M14 22c2 3 2 7 0 10M20 21c2 3 2 8 0 12" fill="none" stroke={c.stripe} strokeWidth={1.6} strokeLinecap="round" />}
        <path d="M11 33v3M17 34v2.5M24 34v2.5M30 33v3" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <g className="anom-bob">
          <path d="M27 12l1-8 6 5ZM39 12l-1-8-6 5Z" fill={c.fur} {...ink} />
          <circle cx={33} cy={17} r={8} fill={c.face} {...ink} />
          {coat === "blackcat" ? (
            <>
              <ellipse cx={30} cy={16} rx={1.8} ry={2.2} fill={c.eye} />
              <ellipse cx={36} cy={16} rx={1.8} ry={2.2} fill={c.eye} />
              <path d="M30 14.6v2.8M36 14.6v2.8" stroke={INK} strokeWidth={0.9} />
            </>
          ) : (
            <>
              <circle cx={30} cy={16} r={1.3} fill={c.eye} />
              <circle cx={36} cy={16} r={1.3} fill={c.eye} />
            </>
          )}
          <path d="M32 19.5l1 0.8 1-0.8" fill="none" stroke={coat === "blackcat" ? "#d4d4d8" : INK} strokeWidth={1.2} strokeLinecap="round" />
          <path d="M26 19h-4M40 19h4" stroke={coat === "blackcat" ? "#d4d4d8" : INK} strokeWidth={0.9} />
          {coat === "goldcat" && (
            <>
              {/* A beckoning paw and a coin, like the lucky cat at a shop's till. */}
              <path className="anom-wave" d="M41 23c2-2 3-6 2-8" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
              <path className="anom-wave" d="M41 23c2-2 3-6 2-8" fill="none" stroke={c.face} strokeWidth={2.6} strokeLinecap="round" />
              <circle cx={20} cy={28} r={4} fill="#fef08a" stroke={INK} strokeWidth={1.3} />
              <path d="M20 26v4" stroke="#a16207" strokeWidth={1.2} />
            </>
          )}
        </g>
      </svg>
    );
  };
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

function Rooster() {
  return (
    <svg width={42} height={44} viewBox="0 0 42 44" style={{ display: "block", overflow: "visible" }}>
      <path className="anom-tail" d="M12 26C4 22 2 12 6 6c2 6 5 9 9 10" fill="#065f46" {...ink} />
      <path d="M12 27C6 26 3 20 4 15c3 4 6 6 10 6" fill="#ea580c" {...ink} strokeWidth={1.6} />
      <ellipse cx={20} cy={28} rx={11} ry={9} fill="#fffbeb" {...ink} />
      <path d="M15 26c3 2 7 2 10 0" fill="none" stroke="#d6d3d1" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M17 36l-1 6M23 36l1 6M14 42h4M22 42h4" stroke="#f59e0b" strokeWidth={2.4} strokeLinecap="round" />
      <g className="anom-peck">
        <path d="M25 22c1-4 2-8 4-10" fill="none" stroke={INK} strokeWidth={8} strokeLinecap="round" />
        <path d="M25 22c1-4 2-8 4-10" fill="none" stroke="#fffbeb" strokeWidth={5} strokeLinecap="round" />
        <path d="M26 7c0-3 2-4 3-2 0-3 3-3 3 0 1-2 4-1 3 2Z" fill="#dc2626" {...ink} strokeWidth={1.4} />
        <circle cx={30} cy={11} r={5} fill="#fffbeb" {...ink} />
        <circle cx={31.5} cy={10} r={1.1} fill={INK} />
        <path d="M34.5 10.5l4 1.5-4 1.5Z" fill="#f59e0b" {...ink} strokeWidth={1.2} />
        <path d="M33 14c0 3 1 4 2 4s1-2 0-4" fill="#dc2626" {...ink} strokeWidth={1.2} />
      </g>
    </svg>
  );
}

function Turtle() {
  return (
    <svg width={48} height={30} viewBox="0 0 48 30" style={{ display: "block", overflow: "visible" }}>
      <path d="M10 24l-2 4M18 25l-1 4M28 25l1 4M35 24l2 4" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
      <path d="M10 24l-2 4M18 25l-1 4M28 25l1 4M35 24l2 4" stroke="#86efac" strokeWidth={2.2} strokeLinecap="round" />
      <path d="M6 21l-4 2" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path d="M5 23c0-12 8-19 18-19s18 7 18 19Z" fill="#16a34a" {...ink} />
      <path d="M17 9l6-3 6 3v7l-6 3-6-3ZM5.5 19l6-3M40.5 19l-6-3M17 16l-5 7M29 16l5 7" fill="#4ade80" stroke="#14532d" strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M5 23h36" stroke={INK} strokeWidth={2} />
      <g className="anom-bob">
        <path d="M37 20c2-3 5-6 9-5 3 1 3 6 0 7-3 1-6 0-9 0Z" fill="#86efac" {...ink} />
        <circle cx={44} cy={17.5} r={1.2} fill={INK} />
        <path d="M45.5 20.5h1.5" stroke={INK} strokeWidth={1} strokeLinecap="round" />
      </g>
    </svg>
  );
}

function Butterfly() {
  return (
    <svg width={40} height={52} viewBox="0 0 40 52" style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={20} cy={50} rx={6} ry={2} fill="black" opacity={0.15} />
      <g className="anom-float">
        <g className="anom-wing">
          <path d="M20 18C14 4 2 4 3 13c1 6 8 8 17 7Z" fill="#a855f7" {...ink} />
          <path d="M20 21C12 21 5 25 8 31c3 4 9 1 12-8Z" fill="#f472b6" {...ink} />
          <circle cx={10} cy={12} r={2.5} fill="#fde047" stroke={INK} strokeWidth={1} />
        </g>
        <g className="anom-wing anom-wing-r">
          <path d="M20 18C26 4 38 4 37 13c-1 6-8 8-17 7Z" fill="#a855f7" {...ink} />
          <path d="M20 21C28 21 35 25 32 31c-3 4-9 1-12-8Z" fill="#f472b6" {...ink} />
          <circle cx={30} cy={12} r={2.5} fill="#fde047" stroke={INK} strokeWidth={1} />
        </g>
        <ellipse cx={20} cy={21} rx={2.2} ry={8} fill="#3f3f46" {...ink} strokeWidth={1.4} />
        <path d="M19 13c-1-3-3-5-5-6M21 13c1-3 3-5 5-6" fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
      </g>
    </svg>
  );
}

function Robot() {
  return (
    <svg width={34} height={44} viewBox="0 0 34 44" style={{ display: "block", overflow: "visible" }}>
      <g className="anom-bob">
        <path d="M17 6V2" stroke={INK} strokeWidth={2} />
        <circle className="anom-blink" cx={17} cy={2} r={2.4} fill="#ef4444" stroke={INK} strokeWidth={1.2} />
        <rect x={7} y={6} width={20} height={14} rx={4} fill="#cbd5e1" {...ink} />
        <rect x={10} y={9} width={14} height={8} rx={2} fill="#0f172a" />
        <circle cx={14} cy={13} r={1.6} fill="#22d3ee" />
        <circle cx={20} cy={13} r={1.6} fill="#22d3ee" />
      </g>
      <path d="M6 25l-4 5M28 25l4 5" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <rect x={6} y={21} width={22} height={15} rx={3} fill="#94a3b8" {...ink} />
      <rect x={11} y={25} width={12} height={6} rx={1.5} fill="#e2e8f0" stroke={INK} strokeWidth={1.2} />
      <path d="M13 28h2M17 28h4" stroke="#0ea5e9" strokeWidth={1.4} strokeLinecap="round" />
      <circle cx={11} cy={39} r={4} fill="#475569" {...ink} />
      <circle cx={23} cy={39} r={4} fill="#475569" {...ink} />
    </svg>
  );
}

function Ghost() {
  return (
    <svg width={34} height={44} viewBox="0 0 34 44" style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={17} cy={42} rx={9} ry={2} fill="black" opacity={0.15} />
      <g className="anom-float">
        <path d="M3 34V16C3 8 9 2 17 2s14 6 14 14v18l-4-3-3 4-4-4-3 4-4-4-3 4Z" fill="#f8fafc" opacity={0.92} {...ink} />
        <ellipse cx={12} cy={16} rx={2} ry={2.6} fill={INK} />
        <ellipse cx={22} cy={16} rx={2} ry={2.6} fill={INK} />
        <ellipse cx={9} cy={21} rx={2.4} ry={1.4} fill="#fda4af" />
        <ellipse cx={25} cy={21} rx={2.4} ry={1.4} fill="#fda4af" />
        <ellipse cx={17} cy={22} rx={2} ry={2.4} fill={INK} />
      </g>
    </svg>
  );
}

function Ufo() {
  return (
    <svg width={50} height={54} viewBox="0 0 50 54" style={{ display: "block", overflow: "visible" }}>
      <path className="anom-beam" d="M17 26h16l9 26H8Z" fill="#fef08a" opacity={0.35} />
      <ellipse cx={25} cy={52} rx={14} ry={2.5} fill="#fde047" opacity={0.4} />
      <g className="anom-float">
        <path d="M15 17c0-7 4-11 10-11s10 4 10 11Z" fill="#99f6e4" opacity={0.85} {...ink} />
        <circle cx={25} cy={13} r={4} fill="#4ade80" stroke={INK} strokeWidth={1.2} />
        <circle cx={23.5} cy={12.5} r={1} fill={INK} />
        <circle cx={26.5} cy={12.5} r={1} fill={INK} />
        <path d="M23 6l-2-3M27 6l2-3" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
        <ellipse cx={25} cy={20} rx={22} ry={7} fill="#94a3b8" {...ink} />
        <circle className="anom-blink" cx={12} cy={21} r={2} fill="#fde047" stroke={INK} strokeWidth={1} />
        <circle className="anom-blink" cx={25} cy={23} r={2} fill="#f472b6" stroke={INK} strokeWidth={1} style={{ animationDelay: "-0.4s" }} />
        <circle className="anom-blink" cx={38} cy={21} r={2} fill="#22d3ee" stroke={INK} strokeWidth={1} style={{ animationDelay: "-0.8s" }} />
      </g>
    </svg>
  );
}

function Duck() {
  return (
    <svg width={40} height={36} viewBox="0 0 40 36" style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={19} cy={33} rx={14} ry={2.5} fill="#7dd3fc" opacity={0.6} />
      <g className="anom-rock">
        <path d="M4 22c0-6 5-8 10-8h10c7 0 12 4 11 11-1 5-6 8-14 8H12c-5 0-8-4-8-11Z" fill="#facc15" {...ink} />
        <path d="M4 20l-3-4 5 1Z" fill="#facc15" {...ink} strokeWidth={1.4} />
        <path d="M12 22c4 4 10 4 13 0" fill="none" stroke="#ca8a04" strokeWidth={1.8} strokeLinecap="round" />
        <circle cx={27} cy={10} r={8} fill="#facc15" {...ink} />
        <circle cx={29} cy={8} r={1.4} fill={INK} />
        <path d="M33 11c3-1 6 0 6 2s-3 2-6 1Z" fill="#f97316" {...ink} strokeWidth={1.4} />
      </g>
    </svg>
  );
}

/** Si Jobi, the fair's mascot: a little briefcase with a big smile. */
function Mascot() {
  return (
    <svg width={40} height={46} viewBox="0 0 40 46" style={{ display: "block", overflow: "visible" }}>
      <path d="M15 36v8M25 36v8M12 44h5M23 44h5" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path d="M6 22l-4-4" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path className="anom-wave" d="M34 20l4-7" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <g className="anom-bob">
        <path d="M14 10V6c0-2 1-3 3-3h6c2 0 3 1 3 3v4" fill="none" stroke={INK} strokeWidth={3} />
        <rect x={4} y={10} width={32} height={26} rx={5} fill="#b45309" {...ink} />
        <path d="M4 20h32" stroke="#78350f" strokeWidth={2} />
        <rect x={17} y={18} width={6} height={5} rx={1} fill="#fbbf24" stroke={INK} strokeWidth={1.2} />
        <circle cx={13} cy={27} r={1.6} fill={INK} />
        <circle cx={27} cy={27} r={1.6} fill={INK} />
        <path d="M16 30c2 3 6 3 8 0" fill="#fecaca" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
        <ellipse cx={9} cy={30} rx={2.2} ry={1.3} fill="#fb923c" />
        <ellipse cx={31} cy={30} rx={2.2} ry={1.3} fill="#fb923c" />
      </g>
    </svg>
  );
}

function Dragon() {
  return (
    <svg width={50} height={44} viewBox="0 0 50 44" style={{ display: "block", overflow: "visible" }}>
      <path className="anom-tail" d="M12 32C4 32 2 26 5 22c1 3 4 4 7 4" fill="#dc2626" {...ink} />
      <path d="M3 21l1-4 3 3Z" fill="#facc15" {...ink} strokeWidth={1.2} />
      <path className="anom-flap" d="M18 22C14 12 18 6 24 4c0 5 2 9 6 12Z" fill="#fb923c" {...ink} />
      <ellipse cx={22} cy={30} rx={12} ry={9} fill="#dc2626" {...ink} />
      <ellipse cx={24} cy={32} rx={7} ry={5.5} fill="#fde68a" stroke="#b45309" strokeWidth={1} />
      <path d="M15 38v4M21 39v3M27 39v3M31 37v4" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <g className="anom-bob">
        <path d="M33 14l-1-6 4 4ZM39 13l1-6 2 5Z" fill="#facc15" {...ink} strokeWidth={1.4} />
        <path d="M30 26c0-6 2-10 4-11" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
        <path d="M30 26c0-6 2-10 4-11" fill="none" stroke="#dc2626" strokeWidth={6} strokeLinecap="round" />
        <path d="M30 18c0-5 4-7 8-7 5 0 8 3 8 6 0 4-3 6-8 6-4 0-8-1-8-5Z" fill="#dc2626" {...ink} />
        <circle cx={37} cy={15} r={1.6} fill="#fef08a" stroke={INK} strokeWidth={1} />
        <path d="M44 17.5h1.5" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
        <path d="M42 21c3 0 5 1 6 3" fill="none" stroke="#f59e0b" strokeWidth={1.4} strokeLinecap="round" />
      </g>
      <g className="anom-puff">
        <circle cx={49} cy={24} r={2.5} fill="#e5e7eb" stroke={INK} strokeWidth={1} />
        <circle cx={52} cy={21} r={1.8} fill="#e5e7eb" stroke={INK} strokeWidth={1} />
      </g>
    </svg>
  );
}

const SPRITES: Record<AnomalyKind, { node: () => ReactElement; w: number; h: number; turns: boolean }> = {
  cat: { node: catOf("cat"), w: 44, h: 38, turns: true },
  dog: { node: Dog, w: 46, h: 40, turns: true },
  pigeon: { node: Pigeon, w: 40, h: 36, turns: true },
  balloon: { node: Balloon, w: 34, h: 64, turns: false },
  fireflies: { node: Fireflies, w: 44, h: 40, turns: false },
  rooster: { node: Rooster, w: 42, h: 44, turns: true },
  turtle: { node: Turtle, w: 48, h: 30, turns: true },
  butterfly: { node: Butterfly, w: 40, h: 52, turns: false },
  robot: { node: Robot, w: 34, h: 44, turns: true },
  ghost: { node: Ghost, w: 34, h: 44, turns: true },
  ufo: { node: Ufo, w: 50, h: 54, turns: false },
  blackcat: { node: catOf("blackcat"), w: 44, h: 38, turns: true },
  duck: { node: Duck, w: 40, h: 36, turns: true },
  mascot: { node: Mascot, w: 40, h: 46, turns: false },
  goldcat: { node: catOf("goldcat"), w: 44, h: 38, turns: true },
  dragon: { node: Dragon, w: 50, h: 44, turns: true },
};

/** Twinkling stars around a rare one. */
function Glints() {
  return (
    <svg className="anom-glints" viewBox="-30 -30 60 60" aria-hidden>
      {(
        [
          [-22, -16, 0],
          [20, -20, 0.5],
          [24, 8, 1],
          [-20, 12, 1.4],
        ] as const
      ).map(([x, y, d], i) => (
        <path
          key={i}
          className="anom-glint"
          style={{ animationDelay: `-${d}s` }}
          d={`M${x} ${y - 5}L${x + 1.5} ${y - 1.5}L${x + 5} ${y}L${x + 1.5} ${y + 1.5}L${x} ${y + 5}L${x - 1.5} ${y + 1.5}L${x - 5} ${y}L${x - 1.5} ${y - 1.5}Z`}
          fill="#fde047"
          stroke={INK}
          strokeWidth={0.8}
        />
      ))}
    </svg>
  );
}

/** A kind standing still at its own size, for lists (the collection, the organiser's list). */
export function AnomalyIcon({ kind }: { kind: AnomalyKind }) {
  const s = SPRITES[kind];
  const Node = s.node;
  return (
    <div className="anom-icon" style={{ width: s.w, height: s.h }}>
      <Node />
    </div>
  );
}

/** One anomaly: strolling, or (claimed) a sparkle and the coins it gave. */
export function AnomalySprite({ kind, claimed, rare }: { kind: AnomalyKind; claimed?: number; rare?: boolean }) {
  const s = SPRITES[kind];
  const Node = s.node;
  return (
    <div className="anom" data-claimed={claimed !== undefined ? "" : undefined} data-rare={rare ? "" : undefined} style={{ width: s.w, height: s.h }}>
      <div className="anom-wander">
        <div className={s.turns ? "anom-face" : undefined}>
          <Node />
        </div>
        {rare && <Glints />}
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
export function anomalyExtras(a: { id: string; kind: AnomalyKind; name: string; x: number; y: number; claimed?: number; rare?: boolean }, onClick?: () => void): SceneExtra[] {
  const s = SPRITES[a.kind];
  return [
    {
      key: `anomaly-${a.id}`,
      x: a.x - s.w / 96,
      y: a.y - s.h / 48,
      z: a.claimed === undefined ? a.y : a.y + 2,
      node: <AnomalySprite kind={a.kind} claimed={a.claimed} rare={a.rare} />,
      onClick: a.claimed === undefined ? onClick : undefined,
      title: a.name,
    },
  ];
}
