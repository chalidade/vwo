// Furniture and room pieces for CafeScene, drawn in the same "2D casual game" style as the
// characters: flat colours, thick dark outlines, a little shading. Every piece is an SVG sized in
// pixels; CafeScene positions it and sorts it by depth.
import type { Look } from "./Person";
import { Person } from "./Person";

export const INK = "#2b1e19";
const ink = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/** A cup of coffee seen from above, with a saucer. */
function Cup({ x, y, steam }: { x: number; y: number; steam?: boolean }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 1} rx={8} ry={6} fill="#f8fafc" {...ink} strokeWidth={1.4} />
      <circle cx={x} cy={y} r={4.6} fill="#fff" {...ink} strokeWidth={1.4} />
      <circle cx={x} cy={y} r={3} fill="#7c4a2a" />
      <path d={`M${x + 4.5} ${y - 1}q3 1 0 3`} fill="none" {...ink} strokeWidth={1.2} />
      {steam && <path className="rpg-steam" d={`M${x - 1} ${y - 6}q-2 -3 0 -6q2 -3 0 -6`} fill="none" stroke="#fff" strokeWidth={1.6} opacity={0.8} />}
    </g>
  );
}

export function TableSprite({
  shape,
  w,
  h,
  cups,
  label,
}: {
  shape: "round" | "square" | "rect" | "bar";
  w: number;
  h: number;
  cups: { x: number; y: number }[];
  label?: string;
}) {
  const face = shape === "bar" ? 22 : 10;
  const legs = shape === "bar" ? 0 : 7;
  const total = h + face + legs;
  return (
    <svg width={w} height={total} viewBox={`-2 -2 ${w + 4} ${total + 4}`} style={{ overflow: "visible", display: "block" }}>
      <ellipse cx={w / 2} cy={total - 1} rx={w / 2 - 2} ry={6} fill="black" opacity={0.18} />
      {shape === "round" ? (
        <>
          <rect x={w / 2 - 5} y={h / 2 + face} width={10} height={h / 2 + legs - 2} fill="#5b3620" {...ink} />
          <path d={`M0 ${h / 2}v${face}a${w / 2} ${h / 2} 0 0 0 ${w} 0v${-face}Z`} fill="#8f5a2e" {...ink} />
          <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill="#c98b4f" {...ink} />
          <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 7} ry={h / 2 - 7} fill="none" stroke="#e0a868" strokeWidth={2} opacity={0.7} />
        </>
      ) : shape === "bar" ? (
        <>
          <rect x={0} y={h - 2} width={w} height={face + 2} rx={3} fill="#5b3a29" {...ink} />
          {Array.from({ length: Math.floor(w / 24) }, (_, i) => (
            <rect key={i} x={6 + i * 24} y={h + 3} width={16} height={face - 9} rx={2} fill="#6f4834" stroke="#3f2618" strokeWidth={1.5} />
          ))}
          <rect x={0} y={0} width={w} height={h} rx={6} fill="#8c5a3c" {...ink} />
          <rect x={4} y={4} width={w - 8} height={h - 10} rx={4} fill="#a86e48" />
          <path d={`M6 ${h - 5}H${w - 6}`} stroke="#d9a476" strokeWidth={2} opacity={0.6} />
        </>
      ) : (
        <>
          {[6, w - 12].map((lx) => (
            <rect key={lx} x={lx} y={h + face - 4} width={6} height={legs + 4} rx={2} fill="#5b3620" {...ink} strokeWidth={1.6} />
          ))}
          <rect x={0} y={face / 2} width={w} height={h} rx={9} fill="#8f5a2e" {...ink} />
          <rect x={0} y={0} width={w} height={h} rx={9} fill="#c98b4f" {...ink} />
          {Array.from({ length: Math.max(1, Math.floor(h / 22)) }, (_, i) => (
            <path key={i} d={`M8 ${14 + i * 22}H${w - 8}`} stroke="#a8703c" strokeWidth={1.5} opacity={0.55} />
          ))}
          <path d={`M8 6H${w - 8}`} stroke="#e7b47a" strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />
        </>
      )}
      {cups.map((c, i) => (
        <Cup key={i} x={c.x} y={c.y} steam={i % 2 === 0} />
      ))}
      {label && (
        <g>
          <rect x={w / 2 - 17} y={h + face / 2 - 7} width={34} height={13} rx={3} fill="#fef3c7" stroke={INK} strokeWidth={1.3} />
          <text x={w / 2} y={h + face / 2 + 3} textAnchor="middle" fontSize={9} fontWeight={700} fontFamily="ui-monospace, monospace" fill={INK}>
            {label}
          </text>
        </g>
      )}
    </svg>
  );
}

export type ChairSide = "n" | "s" | "w" | "e";

/** A wooden chair. `side` is where the chair stands relative to its table; its back faces away. */
export function ChairSprite({ side, part = "all", cushion = "#e76f51" }: { side: ChairSide; part?: "all" | "seat" | "back"; cushion?: string }) {
  const seat = (
    <g>
      <rect x={7} y={14} width={30} height={24} rx={6} fill="#9a6236" {...ink} />
      <rect x={10} y={16} width={24} height={17} rx={5} fill={cushion} {...ink} strokeWidth={1.5} />
      <path d="M14 20h16" stroke="#fff" strokeWidth={1.6} opacity={0.35} strokeLinecap="round" />
    </g>
  );
  const back =
    side === "n" ? (
      <rect x={7} y={0} width={30} height={16} rx={5} fill="#7f4c2a" {...ink} />
    ) : side === "s" ? (
      <g>
        <rect x={7} y={30} width={30} height={14} rx={5} fill="#7f4c2a" {...ink} />
        <path d="M13 36h18" stroke="#b07a4a" strokeWidth={2} strokeLinecap="round" />
      </g>
    ) : (
      <rect x={side === "w" ? 2 : 32} y={4} width={10} height={34} rx={4} fill="#7f4c2a" {...ink} />
    );
  return (
    <svg width={44} height={46} viewBox="0 0 44 46" style={{ overflow: "visible", display: "block" }}>
      {part !== "back" && <ellipse cx={22} cy={41} rx={15} ry={4} fill="black" opacity={0.18} />}
      {part !== "seat" && side !== "s" && back}
      {part !== "back" && seat}
      {part !== "seat" && side === "s" && back}
    </svg>
  );
}

/** A bar stool, for seats at a bar counter. */
export function StoolSprite() {
  return (
    <svg width={44} height={46} viewBox="0 0 44 46" style={{ overflow: "visible", display: "block" }}>
      <ellipse cx={22} cy={41} rx={12} ry={4} fill="black" opacity={0.18} />
      <path d="M16 26l-3 15M28 26l3 15" {...ink} stroke="#3f2618" strokeWidth={3} />
      <path d="M16 26l-3 15M28 26l3 15" stroke="#9a6236" strokeWidth={1.4} />
      <ellipse cx={22} cy={22} rx={13} ry={9} fill="#2f6f5e" {...ink} />
      <ellipse cx={20} cy={20} rx={7} ry={3.5} fill="#fff" opacity={0.18} />
    </svg>
  );
}

export const BARISTA_LOOK: Look = {
  skin: "#e0ac69",
  hair: "#26201f",
  style: "short",
  outfit: "apron",
  shirt: "#f8fafc",
  accent: "#3f6b4f",
  pants: "#1f2937",
  shoes: "#7c2d12",
  face: "happy",
  hat: "cap",
  hatColor: "#3f6b4f",
};

/** The cashier counter: register, espresso machine and a cake display. Barista drawn separately. */
export function CounterSprite({ w, h }: { w: number; h: number }) {
  const face = 30;
  return (
    <svg width={w} height={h + face} viewBox={`-2 -2 ${w + 4} ${h + face + 4}`} style={{ overflow: "visible", display: "block" }}>
      <rect x={0} y={h - 6} width={w} height={face + 6} rx={4} fill="#7b4a2c" {...ink} />
      {Array.from({ length: Math.floor((w - 8) / 30) }, (_, i) => (
        <rect key={i} x={8 + i * 30} y={h + 2} width={22} height={face - 12} rx={3} fill="#8d5835" stroke="#4e2e1b" strokeWidth={1.5} />
      ))}
      <rect x={0} y={0} width={w} height={h} rx={6} fill="#efe6da" {...ink} />
      <path d={`M6 ${h - 6}H${w - 6}`} stroke="#d6c7b3" strokeWidth={3} />
      {/* Cash register. */}
      <g transform={`translate(${Math.min(30, w * 0.1)}, ${-14})`}>
        <rect x={0} y={10} width={40} height={26} rx={4} fill="#4b5563" {...ink} />
        <rect x={4} y={0} width={24} height={14} rx={2} fill="#1f2937" {...ink} />
        <rect x={7} y={3} width={18} height={7} rx={1} fill="#86efac" className="rpg-glow" />
        {[0, 1, 2].map((r) =>
          [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={5 + c * 8} y={15 + r * 6} width={6} height={4} rx={1} fill="#d1d5db" />),
        )}
      </g>
      {/* Espresso machine. */}
      <g transform={`translate(${w * 0.42}, ${-26})`}>
        <rect x={0} y={0} width={54} height={40} rx={6} fill="#cbd5e1" {...ink} />
        <rect x={5} y={5} width={44} height={10} rx={3} fill="#94a3b8" />
        <circle cx={44} cy={10} r={3} fill="#ef4444" className="rpg-glow" />
        <rect x={12} y={18} width={8} height={10} fill="#334155" {...ink} strokeWidth={1.4} />
        <rect x={34} y={18} width={8} height={10} fill="#334155" {...ink} strokeWidth={1.4} />
        <Cup x={16} y={36} steam />
        <Cup x={38} y={36} />
      </g>
      {/* Cake display. */}
      <g transform={`translate(${w * 0.72}, ${-16})`}>
        <rect x={0} y={4} width={58} height={30} rx={8} fill="#e0f2fe" opacity={0.65} {...ink} />
        <path d="M8 26h14v-8h-14Z" fill="#fbcfe8" {...ink} strokeWidth={1.4} />
        <path d="M8 18h14" stroke="#db2777" strokeWidth={2} />
        <path d="M30 26h18v-9h-18Z" fill="#92400e" {...ink} strokeWidth={1.4} />
        <circle cx={39} cy={15} r={2.5} fill="#ef4444" />
        <path d="M6 8q20-6 46 0" stroke="#fff" strokeWidth={2} fill="none" opacity={0.8} />
      </g>
      {/* "KASIR" plate on the front. */}
      <rect x={w / 2 - 28} y={h + 4} width={56} height={16} rx={4} fill="#fef3c7" stroke={INK} strokeWidth={1.6} />
      <text x={w / 2} y={h + 16} textAnchor="middle" fontSize={11} fontWeight={800} letterSpacing={1.5} fill={INK} fontFamily="system-ui, sans-serif">
        KASIR
      </text>
    </svg>
  );
}

export function Barista() {
  return <Person look={BARISTA_LOOK} />;
}

/** Stairs going up (indoor, against the back wall) or a hatch going down (rooftop). */
export function StairsSprite({ w, h, up, label }: { w: number; h: number; up: boolean; label: string }) {
  const steps = 6;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible", display: "block" }}>
      {up ? (
        <>
          <rect x={0} y={0} width={w} height={h} rx={4} fill="#5b3a29" {...ink} />
          {Array.from({ length: steps }, (_, i) => {
            const y = (h / steps) * i;
            const shade = 40 + i * 9;
            return <rect key={i} x={5} y={y + 2} width={w - 10} height={h / steps - 2} rx={2} fill={`hsl(28 38% ${shade}%)`} stroke={INK} strokeWidth={1.4} />;
          })}
          <path d={`M3 ${h}V4M${w - 3} ${h}V4`} stroke="#3f2618" strokeWidth={4} strokeLinecap="round" />
        </>
      ) : (
        <>
          <rect x={0} y={0} width={w} height={h} rx={6} fill="#1c1410" {...ink} />
          {Array.from({ length: 4 }, (_, i) => (
            <rect key={i} x={6} y={6 + i * ((h - 12) / 4)} width={w - 12} height={(h - 12) / 4 - 3} rx={2} fill={`hsl(28 30% ${44 - i * 8}%)`} />
          ))}
          <path d={`M-2 ${h}V0H${w + 2}`} fill="none" stroke="#9ca3af" strokeWidth={3.5} strokeLinecap="round" />
        </>
      )}
      <g transform={`translate(${w / 2}, ${up ? -12 : -10})`}>
        <rect x={-34} y={-9} width={68} height={17} rx={5} fill="#facc15" stroke={INK} strokeWidth={1.8} />
        <text x={0} y={4} textAnchor="middle" fontSize={10.5} fontWeight={800} fill={INK} fontFamily="system-ui, sans-serif">
          {up ? "▲" : "▼"} {label}
        </text>
      </g>
    </svg>
  );
}

export function PlantSprite({ big = false }: { big?: boolean }) {
  return big ? (
    <svg width={60} height={92} viewBox="0 0 60 92" style={{ overflow: "visible", display: "block" }}>
      <ellipse cx={30} cy={88} rx={18} ry={4} fill="black" opacity={0.2} />
      <g className="pg-sway">
        {[
          "M30 64C10 58 4 38 12 22c10 6 16 22 18 42Z",
          "M30 64C50 58 56 38 48 22c-10 6-16 22-18 42Z",
          "M30 64C22 40 22 16 30 4c8 12 8 36 0 60Z",
          "M30 64C14 62 2 52 2 40c12 0 22 10 28 24Z",
          "M30 64C46 62 58 52 58 40c-12 0-22 10-28 24Z",
        ].map((d, i) => (
          <path key={i} d={d} fill={i % 2 ? "#2f855a" : "#38a169"} {...ink} />
        ))}
      </g>
      <path d="M16 64h28l-4 24H20Z" fill="#c2410c" {...ink} />
      <path d="M14 62h32v6H14Z" fill="#9a3412" {...ink} />
    </svg>
  ) : (
    <svg width={46} height={58} viewBox="0 0 46 58" style={{ overflow: "visible", display: "block" }}>
      <ellipse cx={23} cy={55} rx={14} ry={3.5} fill="black" opacity={0.2} />
      <g className="pg-sway">
        <circle cx={14} cy={22} r={11} fill="#38a169" {...ink} />
        <circle cx={32} cy={22} r={11} fill="#38a169" {...ink} />
        <circle cx={23} cy={13} r={12} fill="#48bb78" {...ink} />
        <circle cx={19} cy={10} r={3} fill="#9ae6b4" opacity={0.7} />
      </g>
      <path d="M11 34h24l-3 20H14Z" fill="#dd6b20" {...ink} />
      <path d="M9 32h28v5H9Z" fill="#c05621" {...ink} />
    </svg>
  );
}

export function ShelfSprite({ w, h }: { w: number; h: number }) {
  const tall = 54;
  const jar = ["#f59e0b", "#7c2d12", "#a16207", "#16a34a", "#b91c1c"];
  return (
    <svg width={w} height={h + tall} viewBox={`0 0 ${w} ${h + tall}`} style={{ overflow: "visible", display: "block" }}>
      <rect x={0} y={0} width={w} height={h + tall} rx={4} fill="#7b4a2c" {...ink} />
      {[0, 1, 2].map((r) => (
        <g key={r}>
          <rect x={5} y={5 + r * ((h + tall - 10) / 3)} width={w - 10} height={(h + tall - 10) / 3 - 4} fill="#4e2e1b" />
          {Array.from({ length: Math.floor((w - 14) / 14) }, (_, i) => (
            <rect
              key={i}
              x={9 + i * 14}
              y={9 + r * ((h + tall - 10) / 3) + (i % 2) * 3}
              width={10}
              height={(h + tall - 10) / 3 - 12 - (i % 2) * 3}
              rx={2}
              fill={jar[(i + r * 2) % jar.length]}
              stroke={INK}
              strokeWidth={1.2}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

export function SofaSprite({ w, h }: { w: number; h: number }) {
  return (
    <svg width={w} height={h + 8} viewBox={`0 0 ${w} ${h + 8}`} style={{ overflow: "visible", display: "block" }}>
      <ellipse cx={w / 2} cy={h + 4} rx={w / 2} ry={5} fill="black" opacity={0.18} />
      <rect x={0} y={0} width={w} height={h} rx={10} fill="#2f6f5e" {...ink} />
      <rect x={0} y={0} width={14} height={h} rx={7} fill="#245a4b" {...ink} />
      {[0, 1].map((i) => (
        <rect key={i} x={14} y={8 + i * ((h - 16) / 2)} width={w - 20} height={(h - 16) / 2 - 2} rx={8} fill="#3c8a74" {...ink} strokeWidth={1.6} />
      ))}
      <rect x={w - 22} y={h / 2 - 12} width={14} height={20} rx={5} fill="#f6c453" {...ink} strokeWidth={1.4} />
    </svg>
  );
}

export function RugSprite({ w, h, label = "SELAMAT DATANG" }: { w: number; h: number; label?: string | null }) {
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <rect x={2} y={2} width={w - 4} height={h - 4} rx={14} fill="#b4533a" stroke="#7c2d12" strokeWidth={3} />
      <rect x={12} y={12} width={w - 24} height={h - 24} rx={8} fill="none" stroke="#f6c453" strokeWidth={3} strokeDasharray="10 6" />
      {label && (
        <text x={w / 2} y={h / 2 + 6} textAnchor="middle" fontSize={16} fontWeight={800} letterSpacing={3} fill="#fde68a" fontFamily="system-ui, sans-serif">
          {label}
        </text>
      )}
    </svg>
  );
}

export function LampSprite() {
  return (
    <svg width={40} height={96} viewBox="0 0 40 96" style={{ overflow: "visible", display: "block" }}>
      <circle cx={20} cy={14} r={34} fill="#fde68a" opacity={0.28} className="rpg-glow" />
      <ellipse cx={20} cy={92} rx={12} ry={3.5} fill="black" opacity={0.22} />
      <path d="M20 22v66" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <path d="M20 22v66" stroke="#4b5563" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M8 22l5-16h14l5 16Z" fill="#fef3c7" {...ink} />
      <rect x={12} y={86} width={16} height={6} rx={3} fill="#374151" {...ink} strokeWidth={1.6} />
    </svg>
  );
}

/** The chalk menu board hung above the counter. Opens the menu book when clicked. */
export function MenuBoard({ w, h }: { w: number; h: number }) {
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      <path d={`M${w * 0.25} -10L${w * 0.5} -22L${w * 0.75} -10`} fill="none" stroke={INK} strokeWidth={1.6} />
      <rect x={0} y={0} width={w} height={h} rx={7} fill="#8a5a3b" {...ink} />
      <rect x={7} y={7} width={w - 14} height={h - 14} rx={4} fill="#2d3b33" />
      <text x={w / 2} y={h * 0.42} textAnchor="middle" fontSize={h * 0.26} fontWeight={800} fill="#fef3c7" fontFamily="Georgia, serif" letterSpacing={3}>
        MENU
      </text>
      <path d={`M${w * 0.22} ${h * 0.5}H${w * 0.78}`} stroke="#fef3c7" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.6} />
      {/* Chalk doodles: a cup and a croissant. */}
      <g fill="none" stroke="#e5e7eb" strokeWidth={1.6} strokeLinecap="round" opacity={0.85}>
        <path d={`M${w * 0.12} ${h * 0.3}h14l-2 12h-10Z M${w * 0.12 + 14} ${h * 0.34}q5 0 3 5`} />
        <path d={`M${w * 0.8} ${h * 0.4}q8-10 16 0q-8 4-16 0Z`} />
      </g>
      <text x={w / 2} y={h * 0.74} textAnchor="middle" fontSize={11} fill="#cbd5e1" fontFamily="system-ui, sans-serif">
        Kopi · Non-kopi · Makanan
      </text>
    </svg>
  );
}

/** The back wall of an indoor floor: wallpaper, wainscot, windows, lamps. */
export function IndoorWall({
  w,
  h,
  windows,
}: {
  w: number;
  h: number;
  windows: number[];
}) {
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>
      <div className="rpg-wallpaper" style={{ position: "absolute", inset: 0 }} />
      <div className="rpg-wainscot" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: h * 0.32 }} />
      <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {windows.map((x) => (
          <g key={x} transform={`translate(${x - 44}, ${h * 0.12})`}>
            <rect x={-4} y={-4} width={96} height={h * 0.5 + 8} rx={6} fill="#6d4329" {...ink} />
            <rect x={0} y={0} width={88} height={h * 0.5} rx={3} fill="#9fd6f2" />
            <path d={`M0 ${h * 0.5 - 14}q22 -16 44 -4t44 -6V${h * 0.5}H0Z`} fill="#86c06c" />
            <circle cx={68} cy={16} r={8} fill="#fff7c2" />
            <path d={`M44 0V${h * 0.5}M0 ${h * 0.25}H88`} stroke="#6d4329" strokeWidth={4} />
            <path d="M8 8l16 16M14 6l10 10" stroke="#fff" strokeWidth={2.5} opacity={0.55} strokeLinecap="round" />
            <rect x={-8} y={h * 0.5 + 2} width={104} height={8} rx={3} fill="#8a5a3b" {...ink} strokeWidth={1.6} />
          </g>
        ))}
        {/* Pendant lamps along the ceiling. */}
        {Array.from({ length: Math.floor(w / 240) }, (_, i) => {
          const x = 120 + i * 240;
          return (
            <g key={i}>
              <path d={`M${x} 0v14`} stroke={INK} strokeWidth={2} />
              <path d={`M${x - 12} 26q12 -16 24 0Z`} fill="#f59e0b" {...ink} strokeWidth={1.8} />
              <circle cx={x} cy={28} r={16} fill="#fde68a" opacity={0.3} className="rpg-glow" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** The open edge of a rooftop: sky, a city skyline, string lights and a railing. */
export function RooftopEdge({ w, h }: { w: number; h: number }) {
  const buildings = Array.from({ length: Math.ceil(w / 70) }, (_, i) => ({ x: i * 70 - 10, bw: 50 + ((i * 37) % 30), bh: 30 + ((i * 53) % 60) }));
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>
      <div className="rpg-sky" style={{ position: "absolute", inset: 0 }} />
      <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
        <circle cx={w * 0.8} cy={h * 0.3} r={18} fill="#fff4c2" />
        <ellipse cx={w * 0.25} cy={h * 0.25} rx={40} ry={10} fill="#fff" opacity={0.8} />
        <ellipse cx={w * 0.55} cy={h * 0.15} rx={30} ry={8} fill="#fff" opacity={0.7} />
        {buildings.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={h - 24 - b.bh} width={b.bw} height={b.bh + 24} fill={i % 2 ? "#7c8db5" : "#6b7aa1"} />
            {Array.from({ length: Math.floor(b.bh / 14) }, (_, r) => (
              <rect key={r} x={b.x + 8} y={h - 16 - b.bh + r * 14} width={b.bw - 16} height={5} fill="#fde68a" opacity={0.55} />
            ))}
          </g>
        ))}
        <path d={`M0 ${h * 0.18}${Array.from({ length: Math.ceil(w / 120) }, (_, i) => `Q${i * 120 + 60} ${h * 0.38} ${(i + 1) * 120} ${h * 0.18}`).join("")}`} fill="none" stroke={INK} strokeWidth={1.5} />
        {Array.from({ length: Math.ceil(w / 30) }, (_, i) => {
          const x = i * 30 + 15;
          const t = ((x % 120) / 120) * Math.PI;
          return <circle key={i} cx={x} cy={h * 0.18 + Math.sin(t) * h * 0.1 + 4} r={4} fill={["#fde68a", "#fca5a5", "#93c5fd"][i % 3]} className="rpg-glow" style={{ animationDelay: `${(i % 5) * 0.3}s` }} />;
        })}
        <rect x={0} y={h - 22} width={w} height={22} fill="#9ca3af" />
        {Array.from({ length: Math.ceil(w / 24) }, (_, i) => (
          <rect key={i} x={i * 24 + 4} y={h - 20} width={5} height={18} fill="#6b7280" />
        ))}
        <rect x={0} y={h - 26} width={w} height={7} rx={3} fill="#d1d5db" stroke={INK} strokeWidth={1.6} />
      </svg>
    </div>
  );
}
