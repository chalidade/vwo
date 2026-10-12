"use client";
// The park outside the building: sky over the hedge, walkways on the grass, trees, benches, lamps, a
// fountain, the event's own building with its entrance, and the plots for the organiser's next
// events, drawn under construction with a "Coming soon" banner. Positions come from PARK in the
// shared package, so the drawing and what blocks walking always agree.
import { BENCH_H, BENCH_W, PARK, type ParkBuilding, lobbyDoor } from "@vwo/shared";
import { memo } from "react";
import type { SceneExtra } from "./CafeScene";
import { INK, LampSprite } from "./Furniture";

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
export const ParkSky = memo(function ParkSky({ w, h }: { w: number; h: number }) {
  const hills = Array.from({ length: Math.ceil(w / 260) + 1 }, (_, i) => i * 260 - 60);
  const towers = Array.from({ length: Math.ceil(w / 90) }, (_, i) => ({ x: i * 90 + 20, bw: 34 + ((i * 29) % 26), bh: 22 + ((i * 47) % 38) }));
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>
      <div className="rpg-sky" style={{ position: "absolute", inset: 0 }} />
      <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
        <circle cx={w * 0.86} cy={h * 0.28} r={20} fill="#fff4c2" />
        <ellipse cx={w * 0.18} cy={h * 0.22} rx={46} ry={11} fill="#fff" opacity={0.85} />
        <ellipse cx={w * 0.47} cy={h * 0.14} rx={34} ry={9} fill="#fff" opacity={0.75} />
        <ellipse cx={w * 0.7} cy={h * 0.3} rx={28} ry={7} fill="#fff" opacity={0.7} />
        {towers.map((b, i) => (
          <rect key={i} x={b.x} y={h - 30 - b.bh} width={b.bw} height={b.bh + 30} fill={i % 2 ? "#a5b4cf" : "#94a3c4"} />
        ))}
        {hills.map((x, i) => (
          <ellipse key={i} cx={x + 130} cy={h - 18} rx={170} ry={34 + (i % 3) * 8} fill={i % 2 ? "#4d7c0f" : "#65a30d"} />
        ))}
        {/* The hedge along the park's back edge. */}
        <rect x={0} y={h - 22} width={w} height={22} fill="#3f6212" />
        {Array.from({ length: Math.ceil(w / 22) }, (_, i) => (
          <circle key={i} cx={i * 22 + 11} cy={h - 20} r={13} fill={i % 2 ? "#4d7c0f" : "#3f6212"} />
        ))}
      </svg>
    </div>
  );
});

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

/** The fountain in the plaza: a stone basin, a bowl on a column, and water. */
const Fountain = memo(function Fountain() {
  const W = PARK.fountain.width * T;
  const H = PARK.fountain.height * T + 70;
  const by = H - PARK.fountain.height * T * 0.5;
  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={W / 2} cy={H - 6} rx={W / 2} ry={12} fill="black" opacity={0.18} />
      <ellipse cx={W / 2} cy={by + 10} rx={W / 2 - 2} ry={PARK.fountain.height * T * 0.42} fill="#cbd5e1" {...ink} />
      <ellipse cx={W / 2} cy={by + 4} rx={W / 2 - 16} ry={PARK.fountain.height * T * 0.32} fill="#38bdf8" stroke="#0369a1" strokeWidth={2} />
      <ellipse className="park-ripple" cx={W / 2} cy={by + 6} rx={W / 4} ry={12} fill="none" stroke="#e0f2fe" strokeWidth={2} />
      <rect x={W / 2 - 9} y={by - 70} width={18} height={74} fill="#e2e8f0" {...ink} />
      <ellipse cx={W / 2} cy={by - 70} rx={40} ry={11} fill="#e2e8f0" {...ink} />
      <ellipse cx={W / 2} cy={by - 72} rx={30} ry={6} fill="#7dd3fc" />
      <g className="park-water" fill="none" stroke="#bae6fd" strokeWidth={3} strokeLinecap="round">
        <path d={`M${W / 2} ${by - 76}q-30 -40 -56 30`} />
        <path d={`M${W / 2} ${by - 76}q30 -40 56 30`} />
        <path d={`M${W / 2} ${by - 76}V${by - 112}`} />
      </g>
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

/** Everything drawn in the park. `buildings` fill the plots in order (see parkPlots); tapping a
 *  building walks up to it, tapping the event's building walks to its door. */
export function parkExtras(view: {
  eventName: string;
  plots: { plot: { x: number; y: number; width: number; height: number }; building: ParkBuilding | null }[];
  onEnter?: () => void;
  onPlot?: (i: number) => void;
}): SceneExtra[] {
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
      node: b ? <SoonBuilding name={b.name} date={b.date} accent={accentOf(b.id)} /> : <EmptyPlot />,
    });
  });
  const f = PARK.fountain;
  out.push({ key: "park-fountain", x: f.x, y: f.y + f.height - (f.height + 70 / T), z: f.y + f.height, w: f.width, h: f.height + 2, node: <Fountain /> });
  PARK.beds.forEach((b, i) => out.push({ key: `park-bed-${i}`, x: b.x, y: b.y - 6 / T, z: b.y + b.height, w: b.width, node: <FlowerBed w={b.width * T} h={b.height * T} /> }));
  PARK.trees.forEach((t, i) => out.push({ key: `park-tree-${i}`, x: t.x - 55 / T, y: t.y - 146 / T, z: t.y, node: <TreeSprite seed={i} /> }));
  // Under whoever sits on it.
  PARK.benches.forEach((b, i) => out.push({ key: `park-bench-${i}`, x: b.x, y: b.y + BENCH_H - 52 / T, z: b.y + 0.3, node: <BenchSprite /> }));
  PARK.lamps.forEach((l, i) => out.push({ key: `park-lamp-${i}`, x: l.x - 20 / T, y: l.y - 92 / T, z: l.y, node: <LampSprite /> }));
  return out;
}

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
