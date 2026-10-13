"use client";
// The park outside the building: sky over the hedge, walkways on the grass, trees, benches, lamps, a
// fountain, the event's own building with its entrance, and the plots for the organiser's next
// events, drawn under construction with a "Coming soon" banner, and the Perpustakaan. Positions come from PARK in the
// shared package, so the drawing and what blocks walking always agree.
import { BENCH_H, BENCH_W, PARK, PIGEON_FLOCKS, type ParkBuilding, type ParkNpc, lobbyDoor, parkBuildingDate } from "@vwo/shared";
import { memo } from "react";
import type { SceneExtra } from "./CafeScene";
import { INK, LampSprite } from "./Furniture";
import { FOUNTAIN_BOX, Fountain } from "./Fountain";
import { libraryBuildingExtra } from "./Library";

const ink = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const T = 48;
const font = "system-ui, sans-serif";

/** A steady accent colour per building, from its id. */
const ACCENTS = ["#f97316", "#0ea5e9", "#a855f7", "#16a34a", "#e11d48", "#ca8a04"];
function accentOf(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ACCENTS[(h >>> 0) % ACCENTS.length]!;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** What stands above the park's top edge: sky, clouds, far hills and the city, and a hedge. */
export const ParkSky = memo(function ParkSky({ w, h, dark = 0 }: { w: number; h: number; dark?: number }) {
  const hills = Array.from({ length: Math.ceil(w / 260) + 1 }, (_, i) => i * 260 - 60);
  const towers = Array.from({ length: Math.ceil(w / 90) }, (_, i) => ({ x: i * 90 + 20, bw: 34 + ((i * 29) % 26), bh: 22 + ((i * 47) % 38) }));
  const stars = dark > 0 ? Array.from({ length: Math.ceil(w / 40) }, (_, i) => ({ x: (i * 97) % w, y: 6 + ((i * 53) % Math.max(10, h - 60)), r: i % 3 ? 1.2 : 1.9 })) : [];
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>
      <div className="rpg-sky" style={{ position: "absolute", inset: 0 }} />
      {/* Evening and night: the sky darkens over the day's, with stars, the moon and lit windows. */}
      {dark > 0 && <div className="park-sky-night" style={{ position: "absolute", inset: 0, opacity: dark }} />}
      <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
        {dark < 0.6 ? <circle cx={w * 0.86} cy={h * 0.28 + dark * 40} r={20} fill={dark > 0.2 ? "#fdba74" : "#fff4c2"} /> : <MoonAt x={w * 0.86} y={h * 0.26} />}
        {stars.map((st, i) => (
          <circle key={i} className={i % 4 ? undefined : "park-twinkle"} cx={st.x} cy={st.y} r={st.r} fill="#fefce8" opacity={dark} style={{ animationDelay: `-${i % 7}s` }} />
        ))}
        <ellipse cx={w * 0.18} cy={h * 0.22} rx={46} ry={11} fill="#fff" opacity={0.85 - dark * 0.6} />
        <ellipse cx={w * 0.47} cy={h * 0.14} rx={34} ry={9} fill="#fff" opacity={0.75 - dark * 0.55} />
        <ellipse cx={w * 0.7} cy={h * 0.3} rx={28} ry={7} fill="#fff" opacity={0.7 - dark * 0.5} />
        {towers.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={h - 30 - b.bh} width={b.bw} height={b.bh + 30} fill={dark > 0.5 ? (i % 2 ? "#334155" : "#1e293b") : i % 2 ? "#a5b4cf" : "#94a3c4"} />
            {dark > 0.3 && [0, 1, 2].map((k) => (k + i) % 2 === 0 && <rect key={k} x={b.x + 6 + k * 9} y={h - 22 - b.bh} width={5} height={6} fill="#fde68a" opacity={dark} />)}
          </g>
        ))}
        {hills.map((x, i) => (
          <ellipse key={i} cx={x + 130} cy={h - 18} rx={170} ry={34 + (i % 3) * 8} fill={i % 2 ? "#4d7c0f" : "#65a30d"} />
        ))}
        {/* The hedge along the park's back edge. */}
        <rect x={0} y={h - 22} width={w} height={22} fill="#3f6212" />
        {Array.from({ length: Math.ceil(w / 22) }, (_, i) => (
          <circle key={i} cx={i * 22 + 11} cy={h - 20} r={13} fill={i % 2 ? "#4d7c0f" : "#3f6212"} />
        ))}
        {/* The hills and hedge go dark with the sky. */}
        {dark > 0 && <rect x={0} y={h - 60} width={w} height={60} fill="#0b1440" opacity={dark * 0.45} />}
      </svg>
    </div>
  );
});

function MoonAt({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={30} fill="#fefce8" opacity={0.12} />
      <circle cx={x} cy={y} r={16} fill="#fef9c3" />
      <circle cx={x + 7} cy={y - 4} r={14} fill="#1e2a5a" opacity={0.9} />
    </g>
  );
}

/** The event's own building: glass and stone, its name on the roof, and the way in. */
const EventBuilding = memo(function EventBuilding({ name }: { name: string }) {
  const W = PARK.main.width * T;
  const H = (PARK.main.height + 2.4) * T;
  const door = PARK.door.width * T;
  const cx = (PARK.door.x + PARK.door.width / 2 - PARK.main.x) * T;
  const ground = H - 6;
  const windows: number[] = [];
  for (let x = 34; x < W - 70; x += 66) if (Math.abs(x + 26 - cx) > door / 2 + 52) windows.push(x);
  const sign = Math.min(460, W - 120);
  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={W / 2} cy={ground + 2} rx={W / 2} ry={8} fill="black" opacity={0.18} />
      {/* Flags on the roof. */}
      {[40, W - 40].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 64V12`} stroke={INK} strokeWidth={3} />
          <path className="park-flag" d={`M${x} 13h${i ? -30 : 30}l${i ? 6 : -6} 8l${i ? -6 : 6} 8h${i ? 30 : -30}Z`} fill={i ? "#f97316" : "#dc2626"} {...ink} strokeWidth={1.6} />
        </g>
      ))}
      <rect x={14} y={60} width={W - 28} height={ground - 60} fill="#e2e8f0" {...ink} />
      <rect x={4} y={50} width={W - 8} height={20} rx={3} fill="#475569" {...ink} />
      {/* Two rows of windows, with the glass entrance hall in the middle. */}
      {[86, 158].map((y) =>
        windows.map((x) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width={52} height={50} rx={3} fill="#7dd3fc" {...ink} strokeWidth={1.8} />
            <path d={`M${x + 26} ${y}v50M${x} ${y + 25}h52`} stroke="#0369a1" strokeWidth={1.6} opacity={0.6} />
            <path d={`M${x + 6} ${y + 18}l12 -12M${x + 8} ${y + 30}l22 -22`} stroke="#fff" strokeWidth={2.4} opacity={0.6} strokeLinecap="round" />
          </g>
        )),
      )}
      <rect x={cx - door / 2 - 46} y={78} width={door + 92} height={ground - 78} fill="#bae6fd" {...ink} />
      {Array.from({ length: 5 }, (_, i) => (
        <path key={i} d={`M${cx - door / 2 - 46 + ((door + 92) / 5) * (i + 0.5)} 78V${ground - 120}`} stroke="#0369a1" strokeWidth={1.4} opacity={0.5} />
      ))}
      {/* The name on the roof. */}
      <g transform={`translate(${(W - sign) / 2}, 0)`}>
        <path d={`M30 48v14M${sign - 30} 48v14`} stroke={INK} strokeWidth={3} />
        <rect x={0} y={2} width={sign} height={48} rx={8} fill="#1e3a8a" {...ink} />
        <rect x={6} y={8} width={sign - 12} height={36} rx={5} fill="none" stroke="#fbbf24" strokeWidth={1.6} strokeDasharray="6 4" />
        <text x={sign / 2} y={34} textAnchor="middle" fontSize={22} fontWeight={900} fill="#fff" fontFamily={font} letterSpacing={1}>
          {clip(name.toUpperCase(), 30)}
        </text>
      </g>
      {/* The entrance: a canopy over sliding glass doors, a mat, and plants either side. */}
      <rect x={cx - door / 2 - 30} y={ground - 132} width={door + 60} height={22} rx={4} fill="#f97316" {...ink} />
      <text x={cx} y={ground - 116} textAnchor="middle" fontSize={11} fontWeight={900} fill="#fff" fontFamily={font} letterSpacing={1.5}>
        PINTU MASUK
      </text>
      <rect x={cx - door / 2} y={ground - 108} width={door} height={108} fill="#38bdf8" {...ink} />
      <path d={`M${cx} ${ground - 108}V${ground}`} stroke={INK} strokeWidth={2} />
      <path d={`M${cx - door / 2 + 10} ${ground - 70}l26 -26M${cx + 12} ${ground - 60}l30 -30`} stroke="#fff" strokeWidth={3} opacity={0.55} strokeLinecap="round" />
      <rect x={cx - door / 2 + 6} y={ground - 6} width={door - 12} height={10} rx={3} fill="#b4533a" stroke="#7c2d12" strokeWidth={1.4} />
      {[cx - door / 2 - 22, cx + door / 2 + 22].map((x) => (
        <g key={x}>
          <circle cx={x} cy={ground - 30} r={14} fill="#38a169" {...ink} strokeWidth={1.6} />
          <path d={`M${x - 10} ${ground - 18}h20l-3 18h-14Z`} fill="#c2410c" {...ink} strokeWidth={1.6} />
        </g>
      ))}
    </svg>
  );
});

/** Another event's building, still being built: a concrete frame in scaffolding, a crane, tape
 *  across the front and a banner saying when it opens. */
const SoonBuilding = memo(function SoonBuilding({ name, date, accent }: { name: string; date?: string; accent: string }) {
  const W = PARK.plots[0]!.width * T;
  const H = (PARK.plots[0]!.height + 2) * T;
  const ground = H - 8;
  const cols = [26, W * 0.36, W * 0.64, W - 40];
  const slabs = [96, 166, 236].filter((y) => y < ground - 30);
  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={W / 2} cy={ground + 2} rx={W / 2 - 4} ry={7} fill="black" opacity={0.16} />
      {/* The crane, behind everything. */}
      <g>
        <path d={`M${W - 40} ${ground}V8M${W - 24} ${ground}V8`} stroke={INK} strokeWidth={4} />
        <path d={`M${W - 40} ${ground}V8M${W - 24} ${ground}V8`} stroke="#facc15" strokeWidth={2} />
        <path
          d={Array.from({ length: Math.floor((ground - 8) / 20) }, (_, i) => `M${W - 40} ${ground - i * 20}L${W - 24} ${ground - i * 20 - 20}`).join("")}
          stroke="#ca8a04"
          strokeWidth={1.6}
        />
        <rect x={W * 0.3} y={4} width={W * 0.7 + 10} height={10} fill="#facc15" {...ink} strokeWidth={1.6} />
        <rect x={W - 56} y={14} width={22} height={16} rx={2} fill="#fde68a" {...ink} strokeWidth={1.4} />
        <path d={`M${W * 0.42} 14V58`} stroke={INK} strokeWidth={1.4} />
        <rect x={W * 0.42 - 7} y={58} width={14} height={9} rx={2} fill="#475569" {...ink} strokeWidth={1.2} />
      </g>
      {/* Concrete frame, the top floor not done yet. */}
      {cols.map((x) => (
        <rect key={x} x={x - 7} y={slabs[0]! - 30} width={14} height={ground - slabs[0]! + 30} fill="#9ca3af" {...ink} strokeWidth={1.6} />
      ))}
      {slabs.map((y) => (
        <rect key={y} x={16} y={y} width={W - 40} height={10} fill="#d1d5db" {...ink} strokeWidth={1.6} />
      ))}
      <rect x={16} y={slabs[0]! - 30} width={W * 0.4} height={8} fill="#d1d5db" {...ink} strokeWidth={1.4} />
      <rect x={20} y={ground - 54} width={W * 0.3} height={54} fill="#c2410c" opacity={0.85} {...ink} strokeWidth={1.4} />
      {/* Scaffolding and a safety net. */}
      <rect x={W * 0.52} y={slabs[0]! - 20} width={W * 0.44} height={ground - slabs[0]! + 20} fill="#16a34a" opacity={0.16} />
      <g stroke="#f59e0b" strokeWidth={3}>
        {Array.from({ length: Math.floor((W - 20) / 46) + 1 }, (_, i) => (
          <path key={`v${i}`} d={`M${12 + i * 46} ${slabs[0]! - 26}V${ground}`} />
        ))}
        {[slabs[0]! + 30, slabs[1] ?? 0, ground - 40].map((y, i) => (
          <path key={`h${i}`} d={`M8 ${y}H${W - 10}`} />
        ))}
      </g>
      <rect x={8} y={(slabs[1] ?? 160) - 6} width={W - 18} height={6} fill="#92400e" {...ink} strokeWidth={1.2} />
      {/* The banner. */}
      <g transform={`translate(${W * 0.12}, ${slabs[0]! + 8})`}>
        <rect x={0} y={0} width={W * 0.76} height={96} rx={6} fill="#fff" stroke={accent} strokeWidth={4} />
        <rect x={0} y={0} width={W * 0.76} height={30} rx={6} fill={accent} />
        <text x={W * 0.38} y={22} textAnchor="middle" fontSize={17} fontWeight={900} fill="#fff" fontFamily={font} letterSpacing={2}>
          COMING SOON
        </text>
        <text x={W * 0.38} y={56} textAnchor="middle" fontSize={15} fontWeight={900} fill={INK} fontFamily={font}>
          {clip(name, 26)}
        </text>
        {date && (
          <text x={W * 0.38} y={80} textAnchor="middle" fontSize={12} fontWeight={800} fill={accent} fontFamily={font}>
            {clip(date, 32)}
          </text>
        )}
      </g>
      {/* Barrier tape across the front, and two cones. */}
      {[10, W / 2, W - 10].map((x) => (
        <rect key={x} x={x - 3} y={ground - 34} width={6} height={34} fill="#e5e7eb" {...ink} strokeWidth={1.2} />
      ))}
      <rect x={10} y={ground - 30} width={W - 20} height={9} fill="#facc15" stroke={INK} strokeWidth={1.2} />
      {Array.from({ length: Math.floor((W - 20) / 14) }, (_, i) => (
        <path key={i} d={`M${14 + i * 14} ${ground - 21}l7 -9h5l-7 9Z`} fill="#111827" />
      ))}
      {[W * 0.28, W * 0.72].map((x) => (
        <g key={x}>
          <path d={`M${x - 9} ${ground}l7 -24h4l7 24Z`} fill="#f97316" {...ink} strokeWidth={1.4} />
          <path d={`M${x - 5} ${ground - 10}h10`} stroke="#fff" strokeWidth={3} />
        </g>
      ))}
    </svg>
  );
});

/** A plot nobody has taken: a little garden behind a low hedge. */
const EmptyPlot = memo(function EmptyPlot() {
  const W = PARK.plots[0]!.width * T;
  const H = PARK.plots[0]!.height * T + 40;
  const top = 40;
  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      <rect x={6} y={top} width={W - 12} height={H - top - 6} rx={18} fill="#86c06c" stroke="#3f6212" strokeWidth={8} />
      {Array.from({ length: 16 }, (_, i) => (
        <circle
          key={i}
          cx={30 + ((i * 53) % (W - 60))}
          cy={top + 30 + ((i * 37) % (H - top - 60))}
          r={4}
          fill={["#f472b6", "#facc15", "#f8fafc", "#fb923c"][i % 4]}
          stroke={INK}
          strokeWidth={1}
        />
      ))}
      {[W * 0.28, W * 0.72].map((x, i) => (
        <g key={x}>
          <ellipse cx={x} cy={H - 30} rx={20} ry={5} fill="black" opacity={0.2} />
          <rect x={x - 5} y={H - 70} width={10} height={40} fill="#7c4a2a" {...ink} strokeWidth={1.6} />
          <circle cx={x} cy={H - 92 - i * 6} r={34} fill="#38a169" {...ink} />
          <circle cx={x - 10} cy={H - 104 - i * 6} r={10} fill="#68d391" opacity={0.7} />
        </g>
      ))}
    </svg>
  );
});

/** A round tree; `seed` varies its shade. */
const TreeSprite = memo(function TreeSprite({ seed }: { seed: number }) {
  const green = ["#2f855a", "#38a169", "#276749"][seed % 3]!;
  return (
    <svg width={110} height={150} viewBox="0 0 110 150" style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={55} cy={146} rx={30} ry={6} fill="black" opacity={0.2} />
      <path d="M48 146V96h14v50Z" fill="#7c4a2a" {...ink} />
      <g className="pg-sway" style={{ ["--sway" as string]: `${4 + (seed % 5) / 2}s`, ["--sway-delay" as string]: `-${seed % 7}s` }}>
        <circle cx={32} cy={76} r={28} fill={green} {...ink} />
        <circle cx={78} cy={76} r={28} fill={green} {...ink} />
        <circle cx={55} cy={46} r={36} fill="#48bb78" {...ink} />
        <circle cx={44} cy={34} r={10} fill="#9ae6b4" opacity={0.6} />
      </g>
    </svg>
  );
});

/** A park bench seen from the front: backrest on top, seat below. */
const BenchSprite = memo(function BenchSprite() {
  const w = BENCH_W * T;
  return (
    <svg width={w} height={56} style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={w / 2} cy={52} rx={w / 2 - 6} ry={4} fill="black" opacity={0.18} />
      <path d={`M10 20V52M${w - 10} 20V52`} stroke={INK} strokeWidth={4} />
      <rect x={2} y={0} width={w - 4} height={10} rx={3} fill="#a16207" {...ink} strokeWidth={1.6} />
      <rect x={2} y={12} width={w - 4} height={10} rx={3} fill="#a16207" {...ink} strokeWidth={1.6} />
      <rect x={0} y={26} width={w} height={14} rx={4} fill="#ca8a04" {...ink} strokeWidth={1.8} />
      <path d={`M6 31H${w - 6}`} stroke="#fde68a" strokeWidth={1.6} opacity={0.6} />
    </svg>
  );
});

const FlowerBed = memo(function FlowerBed({ w, h }: { w: number; h: number }) {
  return (
    <svg width={w} height={h + 10} style={{ display: "block", overflow: "visible" }}>
      <rect x={0} y={6} width={w} height={h} rx={8} fill="#7c4a2a" {...ink} />
      {Array.from({ length: Math.max(3, Math.floor(w / 14)) }, (_, i) => (
        <g key={i}>
          <circle cx={9 + i * 14} cy={12 + (i % 2) * 10} r={7} fill="#38a169" stroke={INK} strokeWidth={1} />
          <circle cx={9 + i * 14} cy={10 + (i % 2) * 10} r={3.5} fill={["#f472b6", "#facc15", "#fb7185", "#c084fc"][i % 4]} />
        </g>
      ))}
    </svg>
  );
});

/** The public phone box: a red booth with a handset inside and "TELEPON UMUM" over the door. */
const PhoneBoxSprite = memo(function PhoneBoxSprite() {
  const W = PARK.phoneBox.width * T;
  const H = 128;
  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={W / 2} cy={H - 3} rx={W / 2} ry={5} fill="black" opacity={0.2} />
      <rect x={2} y={8} width={W - 4} height={H - 12} rx={6} fill="#dc2626" {...ink} />
      <path d={`M2 14q${(W - 4) / 2} -14 ${W - 4} 0`} fill="#b91c1c" {...ink} />
      <rect x={8} y={18} width={W - 16} height={14} rx={2} fill="#fef3c7" {...ink} strokeWidth={1.4} />
      <text x={W / 2} y={28.5} textAnchor="middle" fontSize={8} fontWeight={900} fill="#991b1b" fontFamily={font} letterSpacing={0.4}>
        TELEPON UMUM
      </text>
      <rect x={10} y={38} width={W - 20} height={H - 58} rx={3} fill="#bae6fd" {...ink} strokeWidth={1.6} />
      <path d={`M${W / 2} 38v${H - 58}M10 ${38 + (H - 58) / 3}h${W - 20}M10 ${38 + ((H - 58) * 2) / 3}h${W - 20}`} stroke="#b91c1c" strokeWidth={3} />
      {/* The phone on the back wall, its cord and handset. */}
      <rect x={W / 2 + 6} y={52} width={14} height={20} rx={2} fill="#1f2937" stroke={INK} strokeWidth={1.2} />
      <path d={`M${W / 2 + 8} 56h10`} stroke="#fde047" strokeWidth={2} />
      <path d={`M${W / 2 + 13} 72q-4 8 2 12`} fill="none" stroke="#111827" strokeWidth={1.6} />
      <path d={`M8 ${H - 12}h${W - 16}`} stroke="#7f1d1d" strokeWidth={3} />
    </svg>
  );
});

/** The vendor's cart: a wooden gerobak under a striped umbrella; es cendol by day, nasi goreng at night. */
const FoodCart = memo(function FoodCart({ night }: { night: boolean }) {
  const W = PARK.cart.width * T;
  const H = 120;
  const g = H - 6;
  return (
    <svg width={W + 20} height={H} style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={W / 2} cy={g + 2} rx={W / 2 + 6} ry={6} fill="black" opacity={0.2} />
      <path d={`M${W * 0.5} 20V${g - 52}`} stroke={INK} strokeWidth={3} />
      <path d={`M${W * 0.5 - 62} 34q62 -40 124 0Z`} fill="#f97316" {...ink} />
      <path d={`M${W * 0.5 - 30} 32q30 -26 30 -20M${W * 0.5 + 30} 32q-30 -26 -30 -20`} fill="none" stroke="#fff" strokeWidth={6} opacity={0.85} />
      <rect x={6} y={g - 58} width={W - 12} height={40} rx={4} fill="#a16207" {...ink} />
      <rect x={12} y={g - 52} width={W - 24} height={20} rx={3} fill="#fef3c7" {...ink} strokeWidth={1.4} />
      <text x={W / 2} y={g - 38} textAnchor="middle" fontSize={11} fontWeight={900} fill={night ? "#b91c1c" : "#15803d"} fontFamily={font}>
        {night ? "NASI GORENG" : "ES CENDOL"}
      </text>
      {/* Jars on top: green cendol by day, a wok and steam at night. */}
      {night ? (
        <g>
          <path d={`M${W * 0.2} ${g - 58}q14 10 28 0Z`} fill="#374151" {...ink} strokeWidth={1.4} />
          <path
            className="rpg-steam"
            d={`M${W * 0.27} ${g - 64}q-4 -6 0 -12M${W * 0.33} ${g - 64}q4 -6 0 -12`}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      ) : (
        [0.2, 0.36].map((x) => <rect key={x} x={W * x} y={g - 72} width={14} height={14} rx={3} fill="#86efac" {...ink} strokeWidth={1.4} />)
      )}
      <rect x={6} y={g - 18} width={W - 12} height={6} fill="#78350f" />
      {[W * 0.22, W * 0.78].map((x) => (
        <g key={x}>
          <circle cx={x} cy={g - 6} r={9} fill="#374151" {...ink} />
          <circle cx={x} cy={g - 6} r={3} fill="#9ca3af" />
        </g>
      ))}
      <path d={`M${W - 6} ${g - 30}h22`} stroke={INK} strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
});

/** A bicycle rack with two bikes. */
const BikeRack = memo(function BikeRack() {
  const W = PARK.bikes.width * T;
  const bike = (x: number, color: string) => (
    <g transform={`translate(${x}, 0)`}>
      <circle cx={0} cy={34} r={11} fill="none" stroke={INK} strokeWidth={3} />
      <circle cx={34} cy={34} r={11} fill="none" stroke={INK} strokeWidth={3} />
      <path d="M0 34l12-18h16l6 18M12 16l8 18h14M26 10h6M10 12h6" fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
  return (
    <svg width={W} height={50} style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={W / 2} cy={46} rx={W / 2} ry={4} fill="black" opacity={0.16} />
      <path d={`M6 46V24h${W - 12}V46`} fill="none" stroke="#64748b" strokeWidth={4} />
      {bike(14, "#0ea5e9")}
      {bike(W - 50, "#e11d48")}
    </svg>
  );
});

/** The park's map board. */
const Signboard = memo(function Signboard() {
  const W = PARK.signboard.width * T;
  return (
    <svg width={W} height={70} style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={W / 2} cy={66} rx={W / 2 - 4} ry={4} fill="black" opacity={0.18} />
      <path d={`M10 36V66M${W - 10} 36V66`} stroke="#7c4a2a" strokeWidth={5} />
      <rect x={0} y={0} width={W} height={40} rx={4} fill="#14532d" {...ink} />
      <text x={W / 2} y={14} textAnchor="middle" fontSize={9} fontWeight={900} fill="#fef3c7" fontFamily={font} letterSpacing={1}>
        PETA TAMAN
      </text>
      <rect x={8} y={18} width={W - 16} height={16} rx={2} fill="#bbf7d0" />
      <circle cx={W / 2} cy={26} r={4} fill="#38bdf8" stroke={INK} strokeWidth={1} />
      <path d={`M12 22h${W - 24}M${W / 2} 18v16`} stroke="#e7d3a8" strokeWidth={2} />
      <circle cx={W * 0.72} cy={23} r={2.4} fill="#dc2626" />
    </svg>
  );
});

/** The slide. */
const Slide = memo(function Slide() {
  const W = PARK.playground.slide.width * T;
  return (
    <svg width={W + 20} height={110} style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={W / 2 + 6} cy={106} rx={W / 2 + 10} ry={5} fill="black" opacity={0.16} />
      <path d="M8 106V20M28 106V20" stroke="#2563eb" strokeWidth={4} />
      <path d="M8 34h20M8 52h20M8 70h20M8 88h20" stroke="#2563eb" strokeWidth={3} />
      <rect x={4} y={14} width={30} height={8} rx={3} fill="#facc15" {...ink} strokeWidth={1.6} />
      <path d={`M30 18c18 4 24 30 ${W - 14} 84l8 4c-14-4-10-6-12-4`} fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" />
      <path d={`M30 18c18 4 24 30 ${W - 14} 84`} fill="none" stroke="#ef4444" strokeWidth={9} strokeLinecap="round" />
    </svg>
  );
});

/** The swing: a frame with two seats swinging. */
const Swing = memo(function Swing() {
  const W = PARK.playground.swing.width * T;
  return (
    <svg width={W} height={100} style={{ display: "block", overflow: "visible" }}>
      <path d={`M4 96L16 6M28 96L16 6M${W - 4} 96L${W - 16} 6M${W - 28} 96L${W - 16} 6`} stroke="#16a34a" strokeWidth={4} strokeLinecap="round" />
      <path d={`M10 8H${W - 10}`} stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <path d={`M10 8H${W - 10}`} stroke="#22c55e" strokeWidth={3.5} strokeLinecap="round" />
      {[W * 0.36, W * 0.64].map((x, i) => (
        <g key={x} className="park-swing" style={{ transformOrigin: `${x}px 8px`, animationDelay: `-${i * 0.9}s` }}>
          <path d={`M${x - 10} 8v62M${x + 10} 8v62`} stroke="#64748b" strokeWidth={1.6} />
          <rect x={x - 14} y={68} width={28} height={6} rx={2} fill="#f97316" {...ink} strokeWidth={1.4} />
        </g>
      ))}
    </svg>
  );
});

const Sandbox = memo(function Sandbox() {
  const s = PARK.playground.sandbox;
  const W = s.width * T;
  const H = s.height * T;
  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      <rect x={0} y={0} width={W} height={H} rx={8} fill="#fde68a" stroke="#a16207" strokeWidth={6} />
      <path d={`M${W * 0.2} ${H * 0.6}q10 -14 24 0Z`} fill="#fcd34d" stroke="#ca8a04" strokeWidth={1.4} />
      <path d={`M${W * 0.68} ${H * 0.3}l10 -2 2 10-10 2Z`} fill="#38bdf8" stroke={INK} strokeWidth={1.2} />
      <path d={`M${W * 0.72} ${H * 0.62}h10l-2 10h-6Z`} fill="#ef4444" stroke={INK} strokeWidth={1.2} />
    </svg>
  );
});

/** A flock of pigeons pecking at the ground. Startled, they fly off; once nobody is near they come back. */
function Pigeons({ scared }: { scared: boolean }) {
  return (
    <div className="park-pigeons" data-scared={scared ? "" : undefined}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          className="park-pigeon"
          width={22}
          height={18}
          viewBox="0 0 22 18"
          style={{ left: (i * 23) % 70, top: (i * 13) % 22, ["--fly-x" as string]: `${(i % 2 ? 1 : -1) * (60 + i * 14)}px`, animationDelay: `-${i * 0.37}s` }}
        >
          <ellipse cx={9} cy={11} rx={7} ry={4.6} fill="#94a3b8" stroke={INK} strokeWidth={1.4} />
          <path d="M5 9c3-2 6-2 8 1-3 1-6 1-8-1Z" fill="#cbd5e1" stroke={INK} strokeWidth={1} />
          <circle cx={16} cy={6.5} r={3.2} fill="#64748b" stroke={INK} strokeWidth={1.2} />
          <path d="M19 6.5l3 1-3 0.8Z" fill="#fbbf24" />
          <path d="M8 15l-0.5 2.5M11 15l0.5 2.5" stroke="#f97316" strokeWidth={1.4} strokeLinecap="round" />
        </svg>
      ))}
    </div>
  );
}

/** Butterflies fluttering over a flower bed (by day). */
function Butterflies({ seed }: { seed: number }) {
  return (
    <div className="park-flutter" style={{ animationDelay: `-${seed * 2.3}s` }}>
      {[0, 1].map((i) => (
        <svg key={i} className="park-bfly" width={16} height={12} viewBox="0 0 16 12" style={{ left: i * 26, top: i * 10, animationDelay: `-${i * 0.6 + seed}s` }}>
          <path d="M8 6C5 0 0 0 1 4c0 3 4 3 7 2ZM8 6c3-6 8-6 7-2 0 3-4 3-7 2Z" fill={["#f472b6", "#a855f7", "#facc15"][(seed + i) % 3]} stroke={INK} strokeWidth={1} />
          <path d="M8 3v7" stroke={INK} strokeWidth={1.4} />
        </svg>
      ))}
    </div>
  );
}

/** A dog on a lead, walking with its owner. */
function ParkDog({ facing }: { facing: string }) {
  return (
    <svg width={30} height={24} viewBox="0 0 30 24" style={{ display: "block", overflow: "visible", transform: facing === "left" ? "scaleX(-1)" : undefined }}>
      <ellipse cx={14} cy={22} rx={11} ry={2.4} fill="black" opacity={0.2} />
      <path className="anom-wag" d="M5 12l-4-5" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path className="anom-wag" d="M5 12l-4-5" stroke="#f8fafc" strokeWidth={2} strokeLinecap="round" />
      <ellipse cx={13} cy={14} rx={9} ry={5.5} fill="#f8fafc" {...ink} strokeWidth={1.6} />
      <path d="M7 19v3M11 19v3M16 19v3M20 19v3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={22} cy={8} r={5.6} fill="#f8fafc" {...ink} strokeWidth={1.6} />
      <path d="M18 5c-2 1-3 4-2 6 2-1 2-3 2-6Z" fill="#a16207" stroke={INK} strokeWidth={1} />
      <circle cx={23.6} cy={7} r={1} fill={INK} />
      <circle cx={27.2} cy={9} r={1} fill={INK} />
      <path d="M17 11l4 1" stroke="#dc2626" strokeWidth={2} />
    </svg>
  );
}

/** What someone in the park has in hand: a book, a sandwich, a bag of crumbs for the pigeons. */
function ParkProp({ kind }: { kind: "read" | "eat" | "feed" }) {
  if (kind === "read")
    return (
      <svg width={18} height={14} viewBox="0 0 18 14" style={{ display: "block", overflow: "visible" }}>
        <path d="M9 3C6 1 3 1 1 2v10c2-1 5-1 8 1 3-2 6-2 8-1V2c-2-1-5-1-8 1Z" fill="#1d4ed8" stroke={INK} strokeWidth={1.2} />
        <path d="M9 3v10" stroke="#fef3c7" strokeWidth={1.2} />
      </svg>
    );
  if (kind === "eat")
    return (
      <svg width={16} height={12} viewBox="0 0 16 12" style={{ display: "block", overflow: "visible" }}>
        <path d="M1 10l14-4-2 6Z" fill="#fde68a" stroke={INK} strokeWidth={1.2} />
        <path d="M3 9.4l10-3" stroke="#16a34a" strokeWidth={1.6} />
      </svg>
    );
  return (
    <svg width={40} height={18} viewBox="0 0 40 18" style={{ display: "block", overflow: "visible" }}>
      <path d="M2 2h8l-1 9H3Z" fill="#d6a26b" stroke={INK} strokeWidth={1.2} />
      {[14, 20, 26, 31, 36].map((x, i) => (
        <circle key={x} cx={x} cy={12 + (i % 2) * 3} r={1.2} fill="#fef3c7" stroke="#a16207" strokeWidth={0.6} />
      ))}
    </svg>
  );
}

/** Everything drawn in the park. `buildings` fill the plots in order (see parkPlots); tapping a
 *  building walks up to it, tapping the event's building walks to its door. */
export function parkExtras(view: {
  eventName: string;
  plots: { plot: { x: number; y: number; width: number; height: number }; building: ParkBuilding | null }[];
  onEnter?: () => void;
  onPlot?: (i: number) => void;
  /** Walk to the Perpustakaan's door (and go in). */
  onLibrary?: () => void;
  /** Walk to the phone box (and use it). */
  onPhone?: () => void;
  /** How dark it is, 0 by day to 1 at night. */
  dark?: number;
  /** The park's people now (parkNpcsAt): their dog and what they hold are drawn here. */
  npcs?: readonly ParkNpc[];
  /** Which pigeon flocks are startled (scaredFlocks), in PIGEON_FLOCKS order. */
  scared?: readonly boolean[];
}): SceneExtra[] {
  const night = (view.dark ?? 0) > 0.5;
  const out: SceneExtra[] = [];
  // Wide and tall things say how far they reach, so they stay drawn while any part is on screen.
  for (const [i, p] of PARK.paths.entries())
    out.push({
      key: `park-path-${i}`,
      ...p,
      w: p.width,
      h: p.height,
      z: 0,
      ground: true,
      node: <div className="park-path" style={{ width: p.width * T, height: p.height * T }} />,
    });
  const pl = PARK.plaza;
  out.push({
    key: "park-plaza",
    ...pl,
    w: pl.width,
    h: pl.height,
    z: 0,
    ground: true,
    node: <div className="park-plaza" style={{ width: pl.width * T, height: pl.height * T }} />,
  });
  const m = PARK.main;
  out.push({
    key: "park-main",
    x: m.x,
    y: m.y + m.height - (m.height + 2.4),
    z: m.y + m.height,
    w: m.width,
    h: m.height + 2.4,
    onClick: view.onEnter,
    title: view.onEnter ? `Masuk ke ${view.eventName}` : undefined,
    node: <EventBuilding name={view.eventName} />,
  });
  view.plots.forEach(({ plot, building }, i) => {
    const b = building;
    out.push({
      key: `park-plot-${i}`,
      x: plot.x,
      y: plot.y + plot.height - (b ? plot.height + 2 : plot.height + 40 / T),
      z: plot.y + plot.height,
      w: plot.width,
      h: plot.height + 2,
      onClick: b && view.onPlot ? () => view.onPlot!(i) : undefined,
      title: b ? `${b.name} · coming soon` : undefined,
      node: b ? <SoonBuilding name={b.name} date={parkBuildingDate(b) || undefined} accent={accentOf(b.id)} /> : <EmptyPlot />,
    });
  });
  out.push(libraryBuildingExtra(view.onLibrary));
  const f = PARK.fountain;
  out.push({ key: "park-fountain", x: f.x, y: f.y - FOUNTAIN_BOX.above, z: f.y + f.height, w: FOUNTAIN_BOX.w, h: FOUNTAIN_BOX.h, node: <Fountain night={night} /> });
  PARK.beds.forEach((b, i) => out.push({ key: `park-bed-${i}`, x: b.x, y: b.y - 6 / T, z: b.y + b.height, w: b.width, node: <FlowerBed w={b.width * T} h={b.height * T} /> }));
  PARK.trees.forEach((t, i) => out.push({ key: `park-tree-${i}`, x: t.x - 55 / T, y: t.y - 146 / T, z: t.y, node: <TreeSprite seed={i} /> }));
  // Under whoever sits on it.
  PARK.benches.forEach((b, i) => out.push({ key: `park-bench-${i}`, x: b.x, y: b.y + BENCH_H - 52 / T, z: b.y + 0.3, node: <BenchSprite /> }));
  PARK.lamps.forEach((l, i) => out.push({ key: `park-lamp-${i}`, x: l.x - 20 / T, y: l.y - 92 / T, z: l.y, node: <LampSprite /> }));

  // The props.
  const pb = PARK.phoneBox;
  out.push({
    key: "park-phone",
    x: pb.x,
    y: pb.y + pb.height - 125 / T,
    z: pb.y + pb.height,
    onClick: view.onPhone,
    title: view.onPhone ? "Telepon umum: telepon teman" : "Telepon umum",
    node: <PhoneBoxSprite />,
  });
  const c = PARK.cart;
  out.push({ key: "park-cart", x: c.x, y: c.y + c.height - 114 / T, z: c.y + c.height, node: <FoodCart night={night} /> });
  const bk = PARK.bikes;
  out.push({ key: "park-bikes", x: bk.x, y: bk.y + bk.height - 46 / T, z: bk.y + bk.height, node: <BikeRack /> });
  const sg = PARK.signboard;
  out.push({ key: "park-signboard", x: sg.x, y: sg.y + sg.height - 66 / T, z: sg.y + sg.height, node: <Signboard /> });
  const pg = PARK.playground;
  out.push({ key: "park-sandbox", ...pg.sandbox, w: pg.sandbox.width, h: pg.sandbox.height, z: 0, ground: true, node: <Sandbox /> });
  out.push({ key: "park-slide", x: pg.slide.x, y: pg.slide.y + pg.slide.height - 106 / T, z: pg.slide.y + pg.slide.height, node: <Slide /> });
  out.push({ key: "park-swing", x: pg.swing.x, y: pg.swing.y + pg.swing.height - 96 / T, z: pg.swing.y + pg.swing.height, node: <Swing /> });

  // Pigeons by day (they roost at night), butterflies over the flower beds.
  if (!night) {
    PIGEON_FLOCKS.forEach((f, i) => out.push({ key: `park-pigeons-${i}`, x: f.x - 45 / T, y: f.y - 20 / T, z: f.y, node: <Pigeons scared={!!view.scared?.[i]} /> }));
    PARK.beds.forEach((b, i) => out.push({ key: `park-bfly-${i}`, x: b.x + b.width / 2 - 0.4, y: b.y - 1.4, z: b.y + b.height + 0.1, node: <Butterflies seed={i} /> }));
  }

  // The park's people: a dog on a lead, a book, a sandwich, crumbs.
  for (const n of view.npcs ?? []) {
    if (n.pet) out.push({ key: `${n.id}-dog`, x: n.pet.x - 15 / T, y: n.pet.y - 22 / T, z: n.pet.y, node: <ParkDog facing={n.pet.facing} /> });
    if (n.activity === "read" || n.activity === "eat")
      out.push({ key: `${n.id}-prop`, x: n.x - 0.18, y: n.y - (n.seated ? 0.62 : 0.8), z: n.y + 0.05, node: <ParkProp kind={n.activity} /> });
    if (n.activity === "feed") out.push({ key: `${n.id}-prop`, x: n.x + 0.1, y: n.y - 0.5, z: n.y + 0.05, node: <ParkProp kind="feed" /> });
  }
  return out;
}

/**
 * What still shows in the dark, drawn over the night's tint: the lamps' light and the pools it
 * throws, fireflies over the lawn, the guard's torch. Nothing by day.
 */
export function parkLights(view: { dark: number; npcs?: readonly ParkNpc[] }): SceneExtra[] {
  if (view.dark <= 0) return [];
  const out: SceneExtra[] = [];
  const o = view.dark;
  // The fountain's lights under the water, and the jet catching them.
  const f = PARK.fountain;
  out.push({
    key: "park-fountain-glow",
    x: f.x,
    y: f.y - FOUNTAIN_BOX.above,
    z: 0,
    w: FOUNTAIN_BOX.w,
    h: FOUNTAIN_BOX.h,
    node: <div className="pf-nightglow" style={{ width: FOUNTAIN_BOX.w * T, height: FOUNTAIN_BOX.h * T, opacity: o, ["--pool-y" as string]: `${FOUNTAIN_BOX.poolY * 100}%` }} />,
  });
  PARK.lamps.forEach((l, i) => {
    out.push({ key: `park-pool-${i}`, x: l.x - 1.6, y: l.y - 0.6, z: 0, w: 3.2, h: 1.6, node: <div className="park-pool" style={{ opacity: o }} /> });
    out.push({ key: `park-glow-${i}`, x: l.x - 1.4, y: l.y - 92 / T + 14 / T - 1.4, z: 0, w: 2.8, h: 2.8, node: <div className="park-lampglow" style={{ opacity: o }} /> });
  });
  if (o > 0.5)
    FIREFLIES.forEach(([x, y], i) =>
      out.push({ key: `park-firefly-${i}`, x, y, z: 0, node: <div className="park-firefly" style={{ animationDelay: `-${(i * 0.73) % 4}s`, opacity: o }} /> }),
    );
  for (const n of view.npcs ?? [])
    if (n.activity === "patrol") {
      const dx = n.facing === "left" ? -1 : n.facing === "right" ? 1 : 0;
      const dy = n.facing === "back" ? -1 : n.facing === "front" ? 1 : 0;
      out.push({ key: `${n.id}-torch`, x: n.x + dx * 1.1 - 0.7, y: n.y + dy * 1.1 - 0.5, z: 0, node: <div className="park-torch" style={{ opacity: o }} /> });
    }
  return out;
}

/** Where the fireflies drift: by the trees and the flower beds. */
const FIREFLIES: readonly (readonly [number, number])[] = [
  [3.6, 10.2],
  [8.2, 9.6],
  [13.4, 10.6],
  [20.2, 11.4],
  [23.2, 10.6],
  [32.6, 10.4],
  [37.4, 11.2],
  [42.8, 10.4],
  [48.8, 10.6],
  [12.8, 15.6],
  [46.8, 15.4],
  [3.2, 21.6],
  [20.8, 21.8],
  [44.8, 21.8],
];

/** The sign on the floor by the lobby's door out to the park. */
export function parkDoorExtras(floor: { height: number }, onClick?: () => void): SceneExtra[] {
  const d = lobbyDoor(floor);
  return [
    {
      key: "park-door-sign",
      x: d.x - 2.6,
      y: d.y + 0.12,
      z: 0,
      ground: true,
      onClick,
      title: onClick ? "Keluar ke taman" : undefined,
      node: (
        <div className="fr-sign park-sign">
          <span>🌳 PINTU TAMAN</span>
          <b>➜</b>
        </div>
      ),
    },
  ];
}
