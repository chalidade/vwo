"use client";
// Decorations a company can place in its job fair booth from the company portal.
// Floor items fill four spots along the booth's front edge, keeping the middle free for visitors.
import { BOOTH_W, type CompanyBooth } from "@vwo/shared";
import { Mascot, mascotFor } from "./Mascot";
import type { SceneExtra } from "./CafeScene";
import { INK } from "./Furniture";

const ink = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const T = 48;

export type AccessorySlot = "floor" | "corner" | "air" | "wall" | "gate";

export interface BoothAccessory {
  id: string;
  name: string;
  emoji: string;
  slot: AccessorySlot;
}

export const BOOTH_ACCESSORIES: BoothAccessory[] = [
  { id: "plant", name: "Tanaman pot", emoji: "🪴", slot: "corner" },
  { id: "flag", name: "Umbul-umbul", emoji: "🚩", slot: "floor" },
  { id: "standee", name: "Maskot", emoji: "🐣", slot: "floor" },
  { id: "giveaway", name: "Rak merchandise", emoji: "🎁", slot: "floor" },
  { id: "coffee", name: "Coffee cart", emoji: "☕", slot: "floor" },
  { id: "beanbag", name: "Bean bag", emoji: "🛋️", slot: "floor" },
  { id: "tv", name: "TV video profil", emoji: "📺", slot: "floor" },
  { id: "photobooth", name: "Photo booth", emoji: "📸", slot: "floor" },
  { id: "balloons", name: "Balon", emoji: "🎈", slot: "air" },
  { id: "neon", name: "Neon \"We're hiring\"", emoji: "💡", slot: "wall" },
  { id: "gapura", name: "Gapura", emoji: "🎋", slot: "gate" },
];

/** At most this many floor items fit in a booth. */
export const FLOOR_SLOTS = 4;
const SLOTS = [
  { x: 0.1, y: 2.3 },
  { x: 1.0, y: 2.42 },
  { x: 4.1, y: 2.42 },
  { x: 5.0, y: 2.3 },
];

function Plant() {
  return (
    <svg width={40} height={58} style={{ display: "block", overflow: "visible" }}>
      <g className="jb-sway">
        <path d="M20 40C8 34 4 22 8 12c6 8 10 16 12 28Z" fill="#22c55e" {...ink} />
        <path d="M20 40C32 32 36 20 31 8c-6 9-10 18-11 32Z" fill="#16a34a" {...ink} />
        <path d="M20 40c-1-14 1-26 4-36 4 12 2 24-4 36Z" fill="#4ade80" {...ink} />
      </g>
      <path d="M8 38h24l-3 18H11Z" fill="#c2410c" {...ink} />
      <rect x={6} y={36} width={28} height={6} rx={2} fill="#ea580c" {...ink} />
    </svg>
  );
}

function Flag({ color }: { color: string }) {
  return (
    <svg width={34} height={84} style={{ display: "block", overflow: "visible" }}>
      <rect x={6} y={2} width={4} height={80} fill="#94a3b8" {...ink} strokeWidth={1.4} />
      <path className="jb-flag" d="M10 6h20v52l-10-7-10 7Z" fill={color} {...ink} />
      <circle cx={20} cy={22} r={6} fill="#fff" {...ink} strokeWidth={1.2} />
      <ellipse cx={8} cy={82} rx={8} ry={3} fill="#334155" />
    </svg>
  );
}

function Standee({ booth }: { booth: CompanyBooth }) {
  return <Mascot kind={booth.media?.mascot ?? mascotFor(booth.id)} color={booth.color} logo={booth.logo} size={1.25} />;
}

function Giveaway({ booth }: { booth: CompanyBooth }) {
  return (
    <svg width={44} height={56} style={{ display: "block", overflow: "visible" }}>
      <rect x={3} y={6} width={38} height={48} rx={2} fill="#e7e5e4" {...ink} />
      <path d="M3 30h38" {...ink} strokeWidth={1.6} />
      {[8, 22].map((x) => (
        <g key={x} transform={`translate(${x} 12)`}>
          <rect width={13} height={16} rx={2} fill={booth.color} {...ink} strokeWidth={1.3} />
          <path d="M3 0q3-5 7 0" fill="none" {...ink} strokeWidth={1.2} />
        </g>
      ))}
      <rect x={8} y={36} width={10} height={14} rx={2} fill="#fff" {...ink} strokeWidth={1.3} />
      <rect x={22} y={38} width={14} height={12} rx={3} fill="#fbbf24" {...ink} strokeWidth={1.3} />
      <text x={22} y={5} textAnchor="middle" fontSize={8} fontWeight={900} fill={INK} fontFamily="system-ui, sans-serif">
        FREE
      </text>
    </svg>
  );
}

function Coffee() {
  return (
    <svg width={46} height={58} style={{ display: "block", overflow: "visible" }}>
      <path className="jb-steam" d="M16 10q-3-4 0-8M24 10q-3-4 0-8" fill="none" stroke="#94a3b8" strokeWidth={1.6} strokeLinecap="round" />
      <rect x={12} y={12} width={8} height={9} rx={1} fill="#fff" {...ink} strokeWidth={1.2} />
      <rect x={22} y={12} width={8} height={9} rx={1} fill="#fff" {...ink} strokeWidth={1.2} />
      <rect x={2} y={21} width={42} height={8} rx={2} fill="#78350f" {...ink} />
      <rect x={5} y={29} width={36} height={20} fill="#b45309" {...ink} />
      <text x={23} y={43} textAnchor="middle" fontSize={8} fontWeight={900} fill="#fff" fontFamily="system-ui, sans-serif">
        KOPI
      </text>
      <circle cx={11} cy={52} r={4} fill="#334155" {...ink} strokeWidth={1.2} />
      <circle cx={35} cy={52} r={4} fill="#334155" {...ink} strokeWidth={1.2} />
    </svg>
  );
}

function Beanbag({ booth }: { booth: CompanyBooth }) {
  return (
    <svg width={46} height={34} style={{ display: "block", overflow: "visible" }}>
      <path d="M3 30q-2-18 10-20t12 8q2 12-2 12Z" fill={booth.color} {...ink} />
      <path d="M22 31q-2-16 10-18t12 9q1 9-3 9Z" fill="#f59e0b" {...ink} />
    </svg>
  );
}

function Tv({ booth }: { booth: CompanyBooth }) {
  return (
    <svg width={46} height={70} style={{ display: "block", overflow: "visible" }}>
      <rect x={1} y={2} width={44} height={30} rx={3} fill="#111827" {...ink} />
      <rect x={4} y={5} width={38} height={24} rx={2} fill={booth.color} />
      <g className="jb-tv">
        <rect x={8} y={18} width={5} height={8} fill="#fff" opacity={0.85} />
        <rect x={16} y={12} width={5} height={14} fill="#fff" opacity={0.85} />
        <rect x={24} y={15} width={5} height={11} fill="#fff" opacity={0.85} />
        <rect x={32} y={9} width={5} height={17} fill="#fff" opacity={0.85} />
      </g>
      <rect x={21} y={32} width={4} height={32} fill="#475569" {...ink} strokeWidth={1.2} />
      <ellipse cx={23} cy={66} rx={12} ry={3.5} fill="#334155" {...ink} strokeWidth={1.2} />
    </svg>
  );
}

function PhotoBooth({ booth }: { booth: CompanyBooth }) {
  return (
    <svg width={46} height={72} style={{ display: "block", overflow: "visible" }}>
      <rect x={2} y={2} width={42} height={54} rx={3} fill="none" stroke={booth.color} strokeWidth={6} />
      <rect x={2} y={2} width={42} height={54} rx={3} fill="none" {...ink} strokeWidth={1.4} />
      <rect x={2} y={44} width={42} height={12} fill={booth.color} {...ink} strokeWidth={1.4} />
      <text x={23} y={53} textAnchor="middle" fontSize={7} fontWeight={900} fill="#fff" fontFamily="system-ui, sans-serif">
        #Kerja{booth.logo}
      </text>
      <text x={23} y={30} textAnchor="middle" fontSize={16}>
        📸
      </text>
      <path d="M10 56l-4 14M36 56l4 14" {...ink} strokeWidth={1.6} />
    </svg>
  );
}

function Balloons({ color }: { color: string }) {
  const colors = [color, "#f43f5e", "#facc15", "#38bdf8"];
  return (
    <svg width={44} height={70} style={{ display: "block", overflow: "visible" }}>
      <g className="jb-float">
        {[
          [12, 14],
          [30, 12],
          [21, 26],
          [8, 32],
        ].map(([x, y], i) => (
          <g key={i}>
            <path d={`M${x} ${y! + 10}Q${x! + 4} ${y! + 30} 22 66`} fill="none" stroke="#64748b" strokeWidth={1} />
            <ellipse cx={x} cy={y} rx={9} ry={11} fill={colors[i]} {...ink} strokeWidth={1.4} />
            <ellipse cx={x! - 3} cy={y! - 4} rx={2} ry={3} fill="#fff" opacity={0.6} />
          </g>
        ))}
      </g>
    </svg>
  );
}

function NeonSign({ color }: { color: string }) {
  return (
    <div className="jb-neon-sign" style={{ ["--c" as string]: color }}>
      WE'RE HIRING
    </div>
  );
}

/** Scene pieces for every decoration the booth has switched on. */
/** Decorations visitors can tap; the rest are just for looks. */
export const INTERACTIVE_ACCESSORIES = new Set(["standee", "giveaway", "coffee", "beanbag", "tv", "photobooth", "balloons", "neon"]);

export function boothAccessoryExtras(booth: CompanyBooth, onUse?: (id: string) => void): SceneExtra[] {
  const on = new Set(booth.accessories ?? []);
  const items = BOOTH_ACCESSORIES.filter((a) => on.has(a.id));
  const { x, y } = booth;
  const out: SceneExtra[] = [];
  let slot = 0;
  for (const a of items) {
    const key = `${booth.id}-acc-${a.id}`;
    if (a.slot === "gate") continue; // drawn with the booth itself, see gateExtras
    if (a.slot === "corner") {
      out.push({ key, x: x + 0.15, y: y - 0.25, z: y + 0.95, node: <Plant /> });
    } else if (a.slot === "air") {
      out.push({ key, x: x - 0.55, y: y - 2.6, z: y + 0.6, node: <Balloons color={booth.color} /> });
      out.push({ key: `${key}-2`, x: x + BOOTH_W - 0.4, y: y - 2.6, z: y + 0.6, node: <Balloons color={booth.color} /> });
    } else if (a.slot === "wall") {
      out.push({ key, x: x + 1.6, y: y - 2.35, z: y + 0.62, node: <NeonSign color={booth.color} /> });
    } else {
      const s = SLOTS[slot++];
      if (!s) continue;
      const node =
        a.id === "flag" ? (
          <Flag color={booth.color} />
        ) : a.id === "standee" ? (
          <Standee booth={booth} />
        ) : a.id === "giveaway" ? (
          <Giveaway booth={booth} />
        ) : a.id === "coffee" ? (
          <Coffee />
        ) : a.id === "beanbag" ? (
          <Beanbag booth={booth} />
        ) : a.id === "tv" ? (
          <Tv booth={booth} />
        ) : (
          <PhotoBooth booth={booth} />
        );
      // Stand every item on the same line near the booth's front edge, whatever its height.
      const h = a.id === "flag" ? 84 : a.id === "tv" ? 70 : a.id === "standee" ? 70 : a.id === "photobooth" ? 72 : a.id === "beanbag" ? 34 : 56;
      out.push({ key, x: x + s.x, y: y + s.y + 1.15 - h / T, z: y + 3.45, node });
    }
  }
  if (onUse)
    for (const e of out) {
      const id = e.key.replace(`${booth.id}-acc-`, "").replace(/-2$/, "");
      const a = BOOTH_ACCESSORIES.find((x) => x.id === id);
      if (a && INTERACTIVE_ACCESSORIES.has(id)) {
        e.onClick = () => onUse(id);
        e.title = `${a.name} ${booth.company}`;
      }
    }
  return out;
}

