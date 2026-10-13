"use client";
// The fountain in the park's plaza: a round stone pool, a column with two bowls that spill over into
// each other, a jet on top and four arcs falling into the pool, with ripples, light on the water, a
// little mist, koi under the surface and ducks paddling round. Everything moves by CSS (transform,
// opacity and dash offsets), so the scene never redraws for it, and it all stops for reduced motion.
// The ducks swim round the column: in front of it on the near half of their circle, behind it on the
// far half (their z-index flips at the two ends, where they are beside it).
import { PARK } from "@vwo/shared";
import { type CSSProperties, memo } from "react";
import { INK } from "./Furniture";

const T = 48;
/** How far the drawing reaches above the fountain's footprint, for the jet. */
export const FOUNTAIN_TOP = 110;

const W = PARK.fountain.width * T;
const H = PARK.fountain.height * T + FOUNTAIN_TOP;
const cx = W / 2;
/** The pool: rim, water, and the wall in front. */
const cy = FOUNTAIN_TOP + PARK.fountain.height * T * 0.5 - 4;
const RX = W / 2 - 3;
const RY = PARK.fountain.height * T * 0.36;
const WALL = 15;
const WX = RX - 13;
const WY = RY - 10;
/** The two bowls on the column and the top of the jet. */
const Y1 = cy - 66;
const Y2 = Y1 - 40;
const JET = 22;

const ink = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const pt = (rx: number, ry: number, y: number, deg: number) => ({ x: cx + rx * Math.cos((deg * Math.PI) / 180), y: y + ry * Math.sin((deg * Math.PI) / 180) });

/** Where the four arcs from the lower bowl land in the pool. */
const ARCS = [
  { from: { x: cx - 38, y: Y1 + 1 }, via: { x: cx - 74, y: Y1 - 36 }, to: { x: cx - 80, y: cy + 4 } },
  { from: { x: cx + 38, y: Y1 + 1 }, via: { x: cx + 74, y: Y1 - 36 }, to: { x: cx + 80, y: cy + 4 } },
  { from: { x: cx - 22, y: Y1 + 8 }, via: { x: cx - 44, y: Y1 - 14 }, to: { x: cx - 44, y: cy + 33 } },
  { from: { x: cx + 22, y: Y1 + 8 }, via: { x: cx + 44, y: Y1 - 14 }, to: { x: cx + 44, y: cy + 33 } },
];

/** The pool, its water and what is on and under the surface (drawn under the ducks). */
function Pool({ night }: { night: boolean }) {
  const joints = [200, 215, 232, 250, 270, 290, 308, 325, 340].map((d) => pt(RX, RY, cy, 360 - d)).filter((p) => p.y > cy + 4);
  const wall = `M${cx - RX} ${cy}A${RX} ${RY} 0 0 0 ${cx + RX} ${cy}V${cy + WALL}A${RX} ${RY} 0 0 1 ${cx - RX} ${cy + WALL}Z`;
  return (
    <svg className="pf-layer" width={W} height={H} aria-hidden>
      <defs>
        <radialGradient id="pf-water" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={night ? "#a5f3fc" : "#7dd3fc"} />
          <stop offset="60%" stopColor={night ? "#22d3ee" : "#38bdf8"} />
          <stop offset="100%" stopColor={night ? "#0e7490" : "#0369a1"} />
        </radialGradient>
        <linearGradient id="pf-stone" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id="pf-rim" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <radialGradient id="pf-under" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ecfeff" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#67e8f9" stopOpacity={0} />
        </radialGradient>
        <clipPath id="pf-clip">
          <ellipse cx={cx} cy={cy + 1} rx={WX} ry={WY} />
        </clipPath>
      </defs>
      <ellipse cx={cx} cy={cy + RY + WALL - 2} rx={RX + 6} ry={11} fill="black" opacity={0.2} />
      {/* The wall in front, in stone blocks. */}
      <path d={wall} fill="url(#pf-stone)" {...ink} />
      {joints.map((p, i) => (
        <path key={i} d={`M${p.x} ${p.y + 1}v${WALL - 2}`} stroke="#475569" strokeWidth={1.2} opacity={0.6} />
      ))}
      <path
        d={`M${cx - RX + 6} ${cy + WALL * 0.5 + 6}Q${cx} ${cy + RY + WALL + 2} ${cx + RX - 6} ${cy + WALL * 0.5 + 6}`}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={1}
        opacity={0.7}
      />
      {/* The rim, its inner edge in shade, then the water. */}
      <ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill="url(#pf-rim)" {...ink} />
      <ellipse cx={cx} cy={cy + 1} rx={WX + 3} ry={WY + 3} fill="#94a3b8" />
      <ellipse cx={cx} cy={cy + 1} rx={WX} ry={WY} fill="url(#pf-water)" stroke="#075985" strokeWidth={1.4} />
      <g clipPath="url(#pf-clip)">
        {/* The rim's shadow on the far side of the water. */}
        <ellipse cx={cx} cy={cy - WY + 2} rx={WX} ry={10} fill="#075985" opacity={0.25} />
        {night && <ellipse className="pf-glow" cx={cx} cy={cy + 6} rx={WX * 0.85} ry={WY * 0.75} fill="url(#pf-under)" />}
        {/* Light dancing on the water. */}
        <g className="pf-caustics" fill="none" stroke="#f0f9ff" strokeWidth={1.6} strokeLinecap="round" opacity={0.45}>
          {[-30, -14, 2, 18, 32].map((dy, i) => (
            <path key={dy} d={`M${cx - WX + 8 + (i % 2) * 14} ${cy + dy}q10 -5 20 0t20 0t20 0t20 0t20 0t20 0t20 0`} style={{ animationDelay: `-${i * 1.3}s` }} />
          ))}
        </g>
        {/* Rings where the water falls in. */}
        {[...ARCS.map((a) => a.to), { x: cx, y: cy + 3 }].map((p, i) => (
          <ellipse
            key={i}
            className="pf-ring"
            cx={p.x}
            cy={p.y}
            rx={i === 4 ? 30 : 12}
            ry={i === 4 ? 11 : 4.5}
            fill="none"
            stroke="#f0f9ff"
            strokeWidth={1.6}
            style={{ animationDelay: `-${(i * 0.37) % 1.6}s` }}
          />
        ))}
        {[
          [cx - 58, cy - 18],
          [cx + 52, cy - 22],
          [cx - 30, cy + 26],
          [cx + 66, cy + 16],
        ].map(([x, y], i) => (
          <path
            key={i}
            className="pf-glint"
            d={`M${x! - 4} ${y}h8M${x} ${y! - 2.5}v5`}
            stroke="#fff"
            strokeWidth={1.6}
            strokeLinecap="round"
            style={{ animationDelay: `-${i * 0.9}s` }}
          />
        ))}
      </g>
    </svg>
  );
}

/** A koi under the water, swimming a loop round the pool, nose first. */
function Koi({ path, secs, delay, color }: { path: string; secs: number; delay: number; color: string }) {
  return (
    <div className="pf-koi" style={{ offsetPath: `path("${path}")`, animationDuration: `${secs}s`, animationDelay: `-${delay}s` }}>
      <svg width={26} height={14} viewBox="0 0 26 14" style={{ display: "block", overflow: "visible" }}>
        <g className="pf-tail">
          <path d="M6 7L0 2.5Q2 7 0 11.5Z" fill={color} />
        </g>
        <ellipse cx={14} cy={7} rx={9} ry={4} fill={color} />
        <ellipse cx={16} cy={6} rx={3} ry={1.8} fill="#fff7ed" />
        <path d="M12 3.5l3 -2.5M12 10.5l3 2.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </svg>
    </div>
  );
}

type DuckKind = "white" | "mallard" | "duckling";

/** A duck seen from the side, facing right, its waterline at (0, 0). */
function DuckSprite({ kind }: { kind: DuckKind }) {
  const body = kind === "mallard" ? "#a8a29e" : kind === "duckling" ? "#fde047" : "#f8fafc";
  const head = kind === "mallard" ? "#15803d" : body;
  const bill = kind === "duckling" ? "#f97316" : kind === "mallard" ? "#facc15" : "#fb923c";
  return (
    <svg width={34} height={26} viewBox="-15 -21 34 26" style={{ display: "block", overflow: "visible", marginLeft: -15, marginTop: -21 }}>
      <ellipse className="pf-wake" cx={0} cy={1} rx={15} ry={3.4} fill="none" stroke="#f0f9ff" strokeWidth={1.4} opacity={0.7} />
      <path d="M-13 -5c0-5 4-7 9-7h7c5 0 8 3 7 8-1 3-4 5-9 5h-6c-4 0-8-2-8-6Z" fill={body} {...ink} strokeWidth={1.6} />
      {kind === "mallard" && <path d="M-11 -6c3 -3 8 -4 12 -2" stroke="#78716c" strokeWidth={2} fill="none" />}
      <path d="M-6 -7q5 -3 9 1" stroke={INK} strokeWidth={1.1} fill="none" opacity={0.5} />
      {kind === "mallard" && <path d="M5 -9.5h6" stroke="#fff" strokeWidth={2} />}
      <circle cx={6} cy={-14} r={5} fill={head} {...ink} strokeWidth={1.6} />
      <circle cx={7.5} cy={-15} r={1} fill={INK} />
      <path d="M10.5 -13.5l4.5 1-4.5 1.6Z" fill={bill} stroke={INK} strokeWidth={1} />
    </svg>
  );
}

/** One duck on its loop round the column: `phase` is how far along (0 to 1) it starts. */
function Duck({ kind, phase, secs }: { kind: DuckKind; phase: number; secs: number }) {
  const ax = 63;
  const ay = 27;
  const vars = {
    left: cx,
    top: cy + 3,
    ["--p" as string]: `${secs}s`,
    ["--half" as string]: `${secs / 2}s`,
    ["--ax" as string]: `${ax}px`,
    ["--ay" as string]: `${ay}px`,
    ["--d" as string]: `${-phase * secs}s`,
    ["--dy" as string]: `${-phase * secs - secs / 4}s`,
    // Where it rests when nothing moves: on the near half, in view.
    ["--rx" as string]: `${Math.round(-ax * Math.cos(phase * 2 * Math.PI))}px`,
    ["--ry" as string]: `${Math.round(ay * Math.abs(Math.sin(phase * 2 * Math.PI)))}px`,
  } as CSSProperties;
  return (
    <div className="pf-duck" style={vars}>
      <div className="pf-dx">
        <div className="pf-dy">
          <div className="pf-face">
            <div className="pf-bob" data-small={kind === "duckling" ? "" : undefined}>
              <DuckSprite kind={kind} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The column, the two bowls and the water in the air (drawn over ducks behind it). */
function Column({ night }: { night: boolean }) {
  const water = night ? "#cffafe" : "#e0f2fe";
  const front = [12, 32, 52, 72, 90, 108, 128, 148, 168];
  const pool1 = (deg: number) => pt(48, 24, cy + 2, deg);
  return (
    <svg className="pf-layer pf-top" width={W} height={H} aria-hidden>
      <defs>
        <linearGradient id="pf-col" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="55%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <radialGradient id="pf-mist" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.75} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Plinth in the water, the column, the lower bowl. */}
      <ellipse cx={cx} cy={cy + 2} rx={22} ry={7} fill="#94a3b8" {...ink} strokeWidth={1.6} />
      <rect x={cx - 10} y={Y1 + 8} width={20} height={cy - Y1 - 6} fill="url(#pf-col)" {...ink} strokeWidth={1.8} />
      <path d={`M${cx - 13} ${cy - 18}h26`} stroke={INK} strokeWidth={1.4} />
      <path d={`M${cx - 48} ${Y1}C${cx - 40} ${Y1 + 30} ${cx + 40} ${Y1 + 30} ${cx + 48} ${Y1}Z`} fill="url(#pf-col)" {...ink} strokeWidth={1.8} />
      <ellipse cx={cx} cy={Y1} rx={48} ry={12} fill="#e2e8f0" {...ink} strokeWidth={1.8} />
      <ellipse cx={cx} cy={Y1 + 1} rx={40} ry={8} fill={night ? "#67e8f9" : "#7dd3fc"} />
      {/* The water spilling over the lower bowl's lip into the pool, as a thin veil. */}
      <path
        d={`M${pt(48, 12, Y1, 8).x} ${pt(48, 12, Y1, 8).y}A48 12 0 0 1 ${pt(48, 12, Y1, 172).x} ${pt(48, 12, Y1, 172).y}L${pool1(172).x} ${pool1(172).y}A48 24 0 0 0 ${pool1(8).x} ${pool1(8).y}Z`}
        fill={water}
        opacity={0.38}
      />
      <g className="pf-flow" fill="none" stroke={water} strokeWidth={2} strokeLinecap="round" strokeDasharray="9 13">
        {front.map((d, i) => {
          const a = pt(48, 12, Y1, d);
          const b = pool1(d);
          return <path key={d} d={`M${a.x} ${a.y}L${b.x} ${b.y}`} style={{ animationDelay: `-${(i * 0.17) % 0.6}s` }} />;
        })}
      </g>
      {/* The upper bowl on a thinner column, and its own small veil. */}
      <rect x={cx - 6} y={Y2 + 6} width={12} height={Y1 - Y2 - 4} fill="url(#pf-col)" {...ink} strokeWidth={1.6} />
      <path d={`M${cx - 26} ${Y2}C${cx - 20} ${Y2 + 18} ${cx + 20} ${Y2 + 18} ${cx + 26} ${Y2}Z`} fill="url(#pf-col)" {...ink} strokeWidth={1.6} />
      <ellipse cx={cx} cy={Y2} rx={26} ry={7} fill="#e2e8f0" {...ink} strokeWidth={1.6} />
      <ellipse cx={cx} cy={Y2 + 0.5} rx={20} ry={4.5} fill={night ? "#67e8f9" : "#7dd3fc"} />
      <g className="pf-flow" fill="none" stroke={water} strokeWidth={1.8} strokeLinecap="round" strokeDasharray="4 7">
        {[20, 55, 90, 125, 160].map((d, i) => {
          const a = pt(26, 7, Y2, d);
          const b = pt(34, 9, Y1 + 1, d);
          return <path key={d} d={`M${a.x} ${a.y}L${b.x} ${b.y}`} style={{ animationDelay: `-${i * 0.21}s` }} />;
        })}
      </g>
      {/* The jet: a column of water up from the finial, opening into a crown that falls into the top bowl. */}
      <circle cx={cx} cy={Y2 - 5} r={5} fill="#e2e8f0" {...ink} strokeWidth={1.4} />
      <path d={`M${cx} ${Y2 - 8}V${JET + 4}`} stroke={water} strokeWidth={6} strokeLinecap="round" opacity={0.55} />
      <path className="pf-flow" d={`M${cx} ${Y2 - 8}V${JET + 4}`} stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeDasharray="6 5" fill="none" />
      <g className="pf-flow" fill="none" stroke={water} strokeWidth={2.2} strokeLinecap="round" strokeDasharray="3 8">
        {[-1, 1].flatMap((s) => [
          <path key={`${s}a`} d={`M${cx} ${JET + 4}Q${cx + s * 16} ${JET - 6} ${cx + s * 24} ${Y2 - 1}`} />,
          <path key={`${s}b`} d={`M${cx} ${JET + 4}Q${cx + s * 8} ${JET - 2} ${cx + s * 12} ${Y2 - 3}`} style={{ animationDelay: "-0.3s" }} />,
        ])}
      </g>
      {/* Four arcs from the lower bowl into the pool, as streams of drops. */}
      <g fill="none" strokeLinecap="round">
        {ARCS.map((a, i) => (
          <g key={i}>
            <path d={`M${a.from.x} ${a.from.y}Q${a.via.x} ${a.via.y} ${a.to.x} ${a.to.y}`} stroke={water} strokeWidth={3.2} opacity={0.45} />
            <path
              className="pf-flow"
              d={`M${a.from.x} ${a.from.y}Q${a.via.x} ${a.via.y} ${a.to.x} ${a.to.y}`}
              stroke="#fff"
              strokeWidth={2}
              strokeDasharray="2 9"
              style={{ animationDelay: `-${i * 0.23}s` }}
            />
          </g>
        ))}
      </g>
      {/* Drops thrown up where the arcs land. */}
      {ARCS.map((a, i) =>
        [-5, 0, 5].map((dx, k) => (
          <circle key={`${i}-${k}`} className="pf-drop" cx={a.to.x + dx} cy={a.to.y - 2} r={1.5} fill="#f0f9ff" style={{ animationDelay: `-${(i * 0.29 + k * 0.41) % 0.9}s` }} />
        )),
      )}
      {/* A soft mist round the crown and over the pool. */}
      <ellipse className="pf-mist" cx={cx} cy={JET + 22} rx={36} ry={22} fill="url(#pf-mist)" />
      <ellipse className="pf-mist" cx={cx} cy={cy - 4} rx={74} ry={16} fill="url(#pf-mist)" opacity={0.5} style={{ animationDelay: "-2s" }} />
    </svg>
  );
}

/** The whole fountain, `W` by `H` pixels with its footprint along the bottom. */
export const Fountain = memo(function Fountain({ night = false }: { night?: boolean }) {
  return (
    <div className="pf" style={{ width: W, height: H }} data-night={night ? "" : undefined}>
      <Pool night={night} />
      <Koi path={`M${cx - 66} ${cy + 8}a66 26 0 1 0 132 0a66 26 0 1 0 -132 0`} secs={19} delay={0} color="#fb923c" />
      <Koi path={`M${cx + 54} ${cy - 6}a54 20 0 1 1 -108 0a54 20 0 1 1 108 0`} secs={15} delay={6} color="#f8fafc" />
      <Duck kind="white" phase={0.15} secs={26} />
      <Duck kind="duckling" phase={0.06} secs={26} />
      <Duck kind="mallard" phase={0.6} secs={26} />
      <Column night={night} />
    </div>
  );
});

/** Size of the drawing in tiles, and how far it starts above the footprint. */
export const FOUNTAIN_BOX = { w: W / T, h: H / T, above: FOUNTAIN_TOP / T, poolY: cy / H };
