"use client";
// Drawings for the job fair's extra places: the lift and its floor signs, the coin stand, food court
// stalls, the seminar stage, and the psikotes proctor's desk.
import { COIN_STAND_H, COIN_STAND_W, type CoinStandView, FAIR_LIFT, type FairRoom, type FairStop, stallRect } from "@vwo/shared";
import type { SceneExtra } from "./CafeScene";
import { INK } from "./Furniture";

const ink = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const T = 48;
const font = "system-ui, sans-serif";

/** The lift: a steel wall piece with two doors, the floor display, and the directory beside it. */
function LiftWall({ here, stops }: { here: string; stops: FairStop[] }) {
  const w = FAIR_LIFT.width * T;
  const h = 3 * T;
  const door = 1.25 * T;
  const dx = w / 2 - door - 2;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <rect x={0} y={18} width={w} height={h - 18} rx={3} fill="#cbd5e1" {...ink} />
      <rect x={0} y={h - 12} width={w} height={12} fill="#64748b" opacity={0.6} />
      {/* Sign and floor display. */}
      <rect x={-6} y={0} width={w + 12} height={30} rx={6} fill="#0f172a" {...ink} />
      <text x={w / 2} y={20} textAnchor="middle" fontSize={14} fontWeight={900} fill="#facc15" fontFamily={font}>
        🛗 LIFT · {here}
      </text>
      {/* Two sets of doors. */}
      {[dx, w / 2 + 2].map((x0, k) => (
        <g key={k}>
          <rect x={x0 + 8} y={40} width={door - 16} height={h - 52} fill="#e2e8f0" {...ink} strokeWidth={1.8} />
          <path d={`M${x0 + door / 2} 40V${h - 12}`} stroke={INK} strokeWidth={1.6} />
          <rect x={x0 + door / 2 - 14} y={44} width={28} height={10} rx={3} fill="#0f172a" />
        </g>
      ))}
      {/* Call buttons. */}
      <rect x={w / 2 - 7} y={70} width={14} height={26} rx={4} fill="#f8fafc" {...ink} strokeWidth={1.4} />
      <path d="M0 -4l4 5h-8Z" transform={`translate(${w / 2}, 78)`} fill="#16a34a" />
      <path d="M0 4l4 -5h-8Z" transform={`translate(${w / 2}, 89)`} fill="#16a34a" />
      {/* Directory: every floor and what is there. */}
      <g transform={`translate(-102, 26)`}>
        <rect width={92} height={stops.length * 15 + 10} rx={5} fill="#fff" {...ink} strokeWidth={1.6} />
        {stops.map((st, i) => (
          <text key={st.floorId} x={6} y={17 + i * 15} fontSize={9.5} fontWeight={st.name === here ? 900 : 700} fill={st.name === here ? "#b45309" : INK} fontFamily={font}>
            {st.level + 1} · {st.emoji} {st.label.length > 12 ? `${st.label.slice(0, 11)}…` : st.label}
          </text>
        ))}
      </g>
    </svg>
  );
}

/** The lift in the corner of a floor, with a mat in front where you wait for it. */
export function liftExtras(here: string, stops: FairStop[], onClick?: () => void): SceneExtra[] {
  return [
    {
      key: "lift",
      x: FAIR_LIFT.x,
      y: FAIR_LIFT.y + FAIR_LIFT.height - 3,
      z: FAIR_LIFT.y + FAIR_LIFT.height,
      onClick,
      title: onClick ? "Naik lift" : undefined,
      node: <LiftWall here={here} stops={stops} />,
    },
    {
      key: "lift-mat",
      x: FAIR_LIFT.x + 0.6,
      y: FAIR_LIFT.y + FAIR_LIFT.height + 0.1,
      z: 0,
      ground: true,
      node: <div className="fr-mat" style={{ width: (FAIR_LIFT.width - 1.2) * T, height: 1.1 * T, ["--c" as string]: "#facc15" }} />,
    },
  ];
}

/** Arrows painted on the floor that point the way to the lift. */
export function liftSignExtras(spots: { x: number; y: number }[], onClick?: () => void): SceneExtra[] {
  const to = { x: FAIR_LIFT.x + FAIR_LIFT.width / 2, y: FAIR_LIFT.y + FAIR_LIFT.height + 0.6 };
  return spots.map((p, i) => {
    const deg = (Math.atan2(to.y - p.y, to.x - p.x) * 180) / Math.PI;
    return {
      key: `lift-sign-${i}`,
      x: p.x - 1,
      y: p.y - 0.35,
      z: 0,
      ground: true,
      onClick,
      title: onClick ? "Ke lift" : undefined,
      node: (
        <div className="fr-sign">
          <span>🛗 LIFT</span>
          <b style={{ transform: `rotate(${deg}deg)` }}>➜</b>
        </div>
      ),
    };
  });
}

/** The coin stand: a gold counter with a price list. */
export function coinStandExtras(stand: CoinStandView, onClick?: () => void): SceneExtra[] {
  const w = COIN_STAND_W * T;
  return [
    {
      key: "coin-carpet",
      x: stand.x + 0.1,
      y: stand.y + 0.5,
      z: 0,
      ground: true,
      node: <div className="jb-carpet" style={{ width: (COIN_STAND_W - 0.2) * T, height: (COIN_STAND_H - 0.5) * T, ["--c" as string]: "#ca8a04" }} />,
    },
    {
      key: "coin-panel",
      x: stand.x,
      y: stand.y - 1.5,
      z: stand.y + 0.5,
      node: (
        <svg width={w} height={2 * T} style={{ display: "block", overflow: "visible" }}>
          <rect x={6} y={10} width={w - 12} height={2 * T - 12} fill="#fffbeb" {...ink} strokeWidth={1.8} />
          <rect x={-4} y={0} width={w + 8} height={32} rx={4} fill="#ca8a04" {...ink} />
          <text x={w / 2} y={22} textAnchor="middle" fontSize={15} fontWeight={900} fill="#fff" fontFamily={font}>
            🪙 STAND KOIN · ISI SALDO
          </text>
          {stand.packages.map((p, i) => (
            <g key={p.id} transform={`translate(${16 + i * ((w - 32) / stand.packages.length)}, 42)`}>
              <rect width={(w - 32) / stand.packages.length - 8} height={44} rx={4} fill="#fff" {...ink} strokeWidth={1.4} />
              <text x={((w - 32) / stand.packages.length - 8) / 2} y={19} textAnchor="middle" fontSize={13} fontWeight={900} fill="#a16207" fontFamily={font}>
                {p.coins + p.bonus}🪙
              </text>
              <text x={((w - 32) / stand.packages.length - 8) / 2} y={35} textAnchor="middle" fontSize={10} fontWeight={700} fill={INK} fontFamily={font}>
                {p.price}
              </text>
            </g>
          ))}
        </svg>
      ),
    },
    {
      key: "coin-desk",
      x: stand.x + 0.4,
      y: stand.y + 1.2,
      z: stand.y + 2.15,
      onClick,
      title: onClick ? "Beli koin" : undefined,
      node: (
        <svg width={(COIN_STAND_W - 0.8) * T} height={0.95 * T} style={{ display: "block", overflow: "visible" }}>
          <rect x={0} y={0} width={(COIN_STAND_W - 0.8) * T} height={18} rx={4} fill="#fef3c7" {...ink} />
          <rect x={20} y={3} width={30} height={12} rx={2} fill="#1f2937" {...ink} strokeWidth={1.2} />
          <circle cx={(COIN_STAND_W - 0.8) * T - 40} cy={9} r={7} fill="#facc15" {...ink} strokeWidth={1.2} />
          <circle cx={(COIN_STAND_W - 0.8) * T - 28} cy={10} r={7} fill="#fde047" {...ink} strokeWidth={1.2} />
          <rect x={2} y={18} width={(COIN_STAND_W - 0.8) * T - 4} height={0.95 * T - 18} fill="#ca8a04" {...ink} />
          <text x={((COIN_STAND_W - 0.8) * T) / 2} y={0.95 * T - 9} textAnchor="middle" fontSize={12} fontWeight={900} fill="#fff" fontFamily={font}>
            QRIS · E-WALLET · TRANSFER
          </text>
        </svg>
      ),
    },
  ];
}

/** Food court stalls along the back wall: a sign, a counter, and the menu. */
export function foodStallExtras(room: FairRoom, onStall?: (stallId: string) => void): SceneExtra[] {
  return (room.stalls ?? []).flatMap((st, i): SceneExtra[] => {
    const r = stallRect(i);
    const w = r.width * T;
    return [
      {
        key: `${st.id}-back`,
        x: r.x,
        y: r.y - 1.4,
        z: r.y + 0.5,
        node: (
          <svg width={w} height={1.9 * T} style={{ display: "block", overflow: "visible" }}>
            <rect x={6} y={14} width={w - 12} height={1.9 * T - 14} fill="#fff7ed" {...ink} strokeWidth={1.8} />
            <path d={`M-4 0H${w + 4}V30H-4Z`} fill={st.color} {...ink} />
            {Array.from({ length: Math.floor(w / 24) }, (_, k) => (
              <path key={k} d={`M${k * 24 + 2} 30q10 12 20 0`} fill={k % 2 ? "#fff" : st.color} {...ink} strokeWidth={1.4} />
            ))}
            <text x={w / 2} y={21} textAnchor="middle" fontSize={14} fontWeight={900} fill="#fff" fontFamily={font}>
              {st.emoji} {st.name}
            </text>
            {st.menu.map((m, k) => (
              <text key={m.id} x={18} y={62 + k * 15} fontSize={11} fontWeight={700} fill={INK} fontFamily={font}>
                {m.emoji} {m.name} · {m.price}🪙
              </text>
            ))}
          </svg>
        ),
      },
      {
        key: `${st.id}-counter`,
        x: r.x + 0.3,
        y: r.y + 1.15,
        z: r.y + 2.15,
        onClick: onStall ? () => onStall(st.id) : undefined,
        title: onStall ? `Pesan di ${st.name}` : undefined,
        node: (
          <svg width={(r.width - 0.6) * T} height={T} style={{ display: "block", overflow: "visible" }}>
            <rect x={0} y={0} width={(r.width - 0.6) * T} height={18} rx={4} fill="#f5f5f4" {...ink} />
            <text x={18} y={14} fontSize={13} fontFamily={font}>
              {st.menu.map((m) => m.emoji).join(" ")}
            </text>
            <rect x={2} y={18} width={(r.width - 0.6) * T - 4} height={T - 18} fill={st.color} {...ink} />
            <rect x={2} y={T - 8} width={(r.width - 0.6) * T - 4} height={8} fill="#000" opacity={0.2} />
          </svg>
        ),
      },
    ];
  });
}

/** The seminar stage with a projector screen showing the current slide. */
export function seminarStageExtras(room: FairRoom, slide: { title: string; session: string } | null): SceneExtra[] {
  const w = (room.width - 8) * T;
  return [
    {
      key: "stage",
      x: 4,
      y: 0.3,
      z: 0.6,
      node: (
        <svg width={w} height={2.6 * T} style={{ display: "block", overflow: "visible" }}>
          <rect x={0} y={0.9 * T} width={w} height={1.7 * T} rx={4} fill="#7c2d12" {...ink} />
          <rect x={0} y={2.3 * T} width={w} height={0.3 * T} fill="#000" opacity={0.25} />
          <path d={`M0 ${0.9 * T}H${w}`} stroke="#fbbf24" strokeWidth={3} />
          {/* Lectern. */}
          <path d={`M${w / 2 + 70} ${1.25 * T}h40l-6 ${0.95 * T}h-28Z`} fill="#a16207" {...ink} strokeWidth={1.6} />
        </svg>
      ),
    },
    {
      key: "screen",
      x: room.width / 2 - 4.5,
      y: -2.6,
      z: 0.2,
      node: (
        <div className="fr-screen" style={{ width: 9 * T, height: 2.3 * T }}>
          <div className="fr-screen-session">{slide?.session ?? room.name}</div>
          <div className="fr-screen-title">{slide?.title ?? "Seminar karier"}</div>
        </div>
      ),
    },
  ];
}

/** The psikotes proctor's desk and a whiteboard. */
export function psikotesExtras(room: FairRoom): SceneExtra[] {
  const w = 4 * T;
  return [
    {
      key: "board",
      x: room.width / 2 - 3.5,
      y: -2.4,
      z: 0.2,
      node: (
        <div className="fr-whiteboard" style={{ width: 7 * T, height: 2 * T }}>
          <b>PSIKOTES</b>
          <span>Harap tenang · Waktu {5} menit · HP dimatikan</span>
        </div>
      ),
    },
    {
      key: "proctor-desk",
      x: room.width / 2 - 2,
      y: 1.0,
      z: 2.0,
      node: (
        <svg width={w} height={T} style={{ display: "block", overflow: "visible" }}>
          <rect x={0} y={0} width={w} height={18} rx={4} fill="#f1f5f9" {...ink} />
          <rect x={16} y={3} width={40} height={12} rx={1} fill="#fff" {...ink} strokeWidth={1.2} />
          <rect x={w - 44} y={2} width={14} height={13} rx={2} fill="#a78bfa" {...ink} strokeWidth={1.2} />
          <rect x={2} y={18} width={w - 4} height={T - 18} fill={room.color} {...ink} />
          <text x={w / 2} y={T - 9} textAnchor="middle" fontSize={11} fontWeight={900} fill="#fff" fontFamily={font}>
            PENGAWAS
          </text>
        </svg>
      ),
    },
  ];
}
