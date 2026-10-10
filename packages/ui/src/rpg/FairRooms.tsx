"use client";
// Drawings for the job fair's extra places: the lift and its floor signs, the coin stand, food court
// stalls, the seminar stage, and the psikotes proctor's desk.
import { AULA, COIN_STAND_H, LOUNGE, LOUNGE_PLANS, COIN_STAND_W, type CoinStandView, FAIR_LIFT, type FairRoom, type FairStop, type Promoter, price, STALL_SLOTS, stallRect, stallSlot } from "@vwo/shared";
import { useEffect, useRef } from "react";
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

/** Free food court slots: an empty counter with a "for rent" sign, tappable to rent it. */
export function emptyStallExtras(room: FairRoom, onRent?: (slot: number) => void): SceneExtra[] {
  const taken = new Set((room.stalls ?? []).map((st, i) => stallSlot(st, i)));
  return STALL_SLOTS.flatMap((_, slot): SceneExtra[] => {
    if (taken.has(slot)) return [];
    const r = stallRect(slot);
    const w = r.width * T;
    const title = onRent ? "Stan kosong: sewa stan" : "Stan kosong";
    return [
      {
        key: `stall-free-${slot}`,
        x: r.x,
        y: r.y - 0.4,
        z: r.y + 2.15,
        onClick: onRent ? () => onRent(slot) : undefined,
        title,
        node: (
          <svg width={w} height={2.8 * T} style={{ display: "block", overflow: "visible" }}>
            <rect x={6} y={6} width={w - 12} height={1.4 * T} fill="#f5f5f4" {...ink} strokeWidth={1.6} strokeDasharray="6 5" />
            <rect x={14} y={1.55 * T} width={w - 28} height={T - 6} rx={4} fill="#e7e5e4" {...ink} strokeWidth={1.6} />
            <g transform={`translate(${w / 2}, ${0.75 * T})`}>
              <rect x={-58} y={-13} width={116} height={26} rx={6} fill="#16a34a" {...ink} strokeWidth={1.6} />
              <text x={0} y={5} textAnchor="middle" fontSize={12} fontWeight={900} fill="#fff" fontFamily={font}>
                {onRent ? "＋ SEWA STAN" : "STAN KOSONG"}
              </text>
            </g>
          </svg>
        ),
      },
    ];
  });
}

/** Food court stalls along the walls: a business promoting its outlet, with vouchers for sale. */
export function foodStallExtras(room: FairRoom, onStall?: (stallId: string) => void): SceneExtra[] {
  return (room.stalls ?? []).flatMap((st, i): SceneExtra[] => {
    const r = stallRect(stallSlot(st, i));
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
            <foreignObject x={12} y={44} width={w - 24} height={30}>
              <div className="fr-promo">{st.promo}</div>
            </foreignObject>
            <g transform={`translate(${w / 2}, 82)`}>
              <rect x={-62} y={-9} width={124} height={18} rx={9} fill="#facc15" {...ink} strokeWidth={1.4} className="fr-deal" />
              <text x={0} y={4} textAnchor="middle" fontSize={10.5} fontWeight={900} fill={INK} fontFamily={font}>
                {st.deals.length ? `🎟️ VOUCHER mulai ${Math.min(...st.deals.map((d) => d.price))}🪙` : "🎟️ Segera hadir"}
              </text>
            </g>
          </svg>
        ),
      },
      {
        key: `${st.id}-counter`,
        x: r.x + 0.3,
        y: r.y + 1.15,
        z: r.y + 2.15,
        onClick: onStall ? () => onStall(st.id) : undefined,
        title: onStall ? `Promo ${st.name}` : undefined,
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

/** What the seminar's LED wall shows: the session, the slide being presented, and the speaker. */
export interface StageScreen {
  /** "LIVE" or "Sedang berlangsung" */
  badge: string;
  live?: boolean;
  title: string;
  speaker: string;
  role: string;
  slideTitle?: string;
  points?: string[];
  /** "2/4" */
  page?: string;
  next?: string;
  /** The speaker's shared screen, while they broadcast to this room. */
  stream?: MediaStream | null;
}

/** The speaker's live screen on a big LED wall. Always muted: the sound plays once, from the
 *  stage feed panel on the job seeker's screen. */
export function LiveFeed({ stream, className = "fr-feed" }: { stream: MediaStream; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (v && v.srcObject !== stream) {
      v.srcObject = stream;
      void v.play().catch(() => {});
    }
  }, [stream]);
  return (
    <div className={className}>
      <video ref={ref} autoPlay playsInline muted />
    </div>
  );
}

const hasVideo = (s?: MediaStream | null) => !!s && s.getVideoTracks().length > 0;

/** The speaker on the LED wall's camera panel: a simple bust in front of a backdrop. */
function SpeakerCam({ color, name, role }: { color: string; name: string; role: string }) {
  return (
    <div className="fr-cam">
      <svg viewBox="0 0 100 80" preserveAspectRatio="xMidYMax meet" className="fr-cam-bust">
        <path d="M14 80c2-20 16-30 36-30s34 10 36 30Z" fill={color} />
        <path d="M42 50l8 12 8-12" fill="#fff" />
        <circle cx={50} cy={33} r={15} fill="#f2c7a5" />
        <path d="M35 30c0-12 8-17 15-17s15 5 15 17c-4-6-9-8-15-8s-11 2-15 8Z" fill="#3b2a20" />
        <rect x={64} y={56} width={4} height={14} rx={2} fill="#1f2937" />
        <circle cx={66} cy={55} r={4} fill="#334155" />
      </svg>
      <div className="fr-cam-tag">
        <b>{name}</b>
        <span>{role}</span>
      </div>
    </div>
  );
}

/** The seminar stage with a big LED wall: the slide on the left, the speaker's camera on the right,
 *  a ticker below, and two side screens. */
export function seminarStageExtras(room: FairRoom, screen: StageScreen | null): SceneExtra[] {
  const w = (room.width - 8) * T;
  const ledW = 20;
  const sc = screen ?? { badge: "Seminar", title: room.name, speaker: room.staff.name, role: room.staff.role };
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
          {/* Floor lights along the stage edge. */}
          {Array.from({ length: Math.floor(w / 90) }, (_, i) => (
            <circle key={i} cx={45 + i * 90} cy={0.9 * T + 6} r={3} className="jb-bulb" data-odd={i % 2 ? "" : undefined} />
          ))}
        </svg>
      ),
    },
    {
      key: "screen",
      x: room.width / 2 - ledW / 2,
      y: -3.4,
      z: 0.2,
      node: (
        <div className="fr-led" style={{ width: ledW * T, height: 3.05 * T, ["--c" as string]: room.color }}>
          <div className="fr-led-top">
            <span className="fr-led-badge" data-live={sc.live ? "" : undefined}>
              {sc.live ? "● LIVE" : "● " + sc.badge}
            </span>
            <span className="fr-led-title">{sc.title}</span>
            {sc.page && <span className="fr-led-page">{sc.page}</span>}
          </div>
          <div className="fr-led-body">
            {hasVideo(sc.stream) ? (
              <LiveFeed stream={sc.stream!} />
            ) : (
            <div className="fr-led-slide" key={sc.slideTitle}>
              <b>{sc.slideTitle ?? sc.title}</b>
              {sc.points?.length ? (
                <ul>
                  {sc.points.slice(0, 3).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                <span className="fr-led-sub">Seminar karier bersertifikat · duduk di kursi untuk menonton</span>
              )}
            </div>
            )}
            <SpeakerCam color={room.color} name={sc.speaker} role={sc.role} />
          </div>
          <div className="fr-led-ticker">
            <span>
              🎤 {sc.title} · bersama {sc.speaker} · E-sertifikat untuk peserta yang menonton sampai selesai · Tanya jawab di akhir sesi
              {sc.next ? ` · Berikutnya: ${sc.next}` : ""} · #jobfair2026
            </span>
          </div>
        </div>
      ),
    },
    ...[0, 1].map((i) => ({
      key: `side-screen-${i}`,
      x: i === 0 ? 4.4 : room.width - 4.4 - 4.6,
      y: -2.9,
      z: 0.2,
      node: (
        <div className="fr-led fr-led-side" style={{ width: 4.6 * T, height: 2.1 * T, ["--c" as string]: room.color }}>
          {i === 0 ? (
            <>
              <span className="fr-led-badge">SESI BERIKUTNYA</span>
              <b>{sc.next ?? "Cek jadwal di Aula"}</b>
            </>
          ) : (
            <>
              <span className="fr-led-badge">TANYA JAWAB</span>
              <b>Tulis pertanyaanmu di kolom chat 💬</b>
            </>
          )}
        </div>
      ),
    })),
  ];
}

/** What the Aula's screen and boards show. */
export interface AulaScreen {
  now: { title: string; host: string; start: string; end: string; place?: string } | null;
  next: { title: string; host: string; start: string; end: string; place?: string } | null;
  over: boolean;
  /** Someone is speaking live on the Aula stage. */
  live?: { title: string; speaker: string; stream?: MediaStream | null } | null;
  /** The first items of the rundown, for the standing board. */
  rundown: { start: string; title: string; on?: boolean }[];
  announcement?: string;
}

/** The Aula: a wide stage with a podium and an LED wall, a rundown board, an info board, and the meeting point. */
export function aulaExtras(room: FairRoom, screen: AulaScreen, stops: FairStop[], on: { rundown?: () => void; info?: () => void; meet?: () => void } = {}): SceneExtra[] {
  const st = AULA.stage;
  const w = st.width * T;
  const h = (st.height + 0.3) * T;
  const ledW = 18;
  const headline = screen.live ? { tag: "● LIVE", title: screen.live.title, sub: screen.live.speaker } : screen.now ? { tag: `● SEDANG BERLANGSUNG · ${screen.now.start}–${screen.now.end}`, title: screen.now.title, sub: screen.now.host } : screen.over ? { tag: "ACARA HARI INI SELESAI", title: "Terima kasih sudah datang!", sub: "Sampai jumpa di jobfair berikutnya" } : { tag: "SEGERA", title: screen.next?.title ?? room.name, sub: screen.next ? `${screen.next.start} · ${screen.next.host}` : room.tagline };
  return [
    {
      key: "aula-stage",
      x: st.x,
      y: st.y,
      // Behind the MC, who stands on the stage behind the podium.
      z: st.y + 0.95,
      node: (
        <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
          {/* Backdrop curtain, the stage floor, and steps in the middle. */}
          <rect x={0} y={0} width={w} height={0.9 * T} fill="#7f1d1d" {...ink} />
          {Array.from({ length: Math.floor(w / 24) }, (_, i) => (
            <path key={i} d={`M${12 + i * 24} 2V${0.9 * T - 2}`} stroke="#991b1b" strokeWidth={6} />
          ))}
          <rect x={0} y={0.9 * T} width={w} height={st.height * T - 0.9 * T} rx={4} fill="#57301b" {...ink} />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d={`M0 ${0.9 * T + 14 + i * 14}H${w}`} stroke="#6b3a20" strokeWidth={1.4} />
          ))}
          <path d={`M0 ${0.9 * T}H${w}`} stroke="#fbbf24" strokeWidth={3} />
          <rect x={0} y={st.height * T - 10} width={w} height={10} fill="#000" opacity={0.3} />
          <rect x={w / 2 - 1.4 * T} y={st.height * T - 6} width={2.8 * T} height={0.4 * T} rx={3} fill="#7c2d12" {...ink} strokeWidth={1.6} />
          {/* Flower arrangements at the front corners and lights along the edge. */}
          {[0.25 * T, w - 0.95 * T].map((x) => (
            <g key={x} transform={`translate(${x}, ${st.height * T - 40})`}>
              <path d="M6 34h22l-4 -16h-14Z" fill="#a16207" {...ink} strokeWidth={1.4} />
              {[[10, 12], [22, 10], [16, 4], [6, 6], [28, 4]].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r={6} fill={["#f43f5e", "#facc15", "#fb7185", "#fde047", "#f472b6"][i]} {...ink} strokeWidth={1} />
              ))}
            </g>
          ))}
          {Array.from({ length: Math.floor(w / 80) }, (_, i) => (
            <circle key={i} cx={40 + i * 80} cy={0.9 * T + 6} r={3} className="jb-bulb" data-odd={i % 2 ? "" : undefined} />
          ))}
        </svg>
      ),
    },
    {
      // The podium with the event logo, in front of the MC or the speaker.
      key: "aula-podium",
      x: room.width / 2 - 4 - 26 / T,
      y: st.y + 1.55 - 30 / T,
      z: 2.6,
      node: (
        <svg width={60} height={92} style={{ display: "block", overflow: "visible" }}>
          <g transform="translate(0, 30)">
            <path d="M0 0h52l-6 58h-40Z" fill="#1e3a8a" {...ink} strokeWidth={1.8} />
            <rect x={-4} y={-6} width={60} height={10} rx={3} fill="#93c5fd" {...ink} strokeWidth={1.4} />
            <text x={26} y={33} textAnchor="middle" fontSize={10} fontWeight={900} fill="#facc15" fontFamily={font}>
              jobfair
            </text>
            <path d="M40 -6l8 -18" stroke="#1f2937" strokeWidth={2.5} />
            <circle cx={49} cy={-25} r={4} fill="#1f2937" />
          </g>
        </svg>
      ),
    },
    {
      key: "aula-led",
      x: room.width / 2 - ledW / 2,
      y: -3.4,
      z: 0.2,
      onClick: on.rundown,
      title: on.rundown ? "Jadwal acara Aula" : undefined,
      node: (
        <div className="fr-led fr-led-aula" style={{ width: ledW * T, height: 3.05 * T, ["--c" as string]: room.color }}>
          <div className="fr-led-top">
            <span className="fr-led-badge" data-live={screen.live || screen.now ? "" : undefined}>
              {headline.tag}
            </span>
            <span className="fr-led-title">AULA UTAMA · jobfair</span>
          </div>
          {hasVideo(screen.live?.stream) ? (
            <div className="fr-led-feedrow">
              <LiveFeed stream={screen.live!.stream!} />
              <div className="fr-led-caption">
                <b>{headline.title}</b>
                <span>{headline.sub}</span>
              </div>
            </div>
          ) : (
            <div className="fr-led-hero">
              <b>{headline.title}</b>
              <span>{headline.sub}</span>
            </div>
          )}
          <div className="fr-led-ticker">
            <span>
              {screen.next ? `⏭ Berikutnya ${screen.next.start}: ${screen.next.title} · ` : ""}
              {screen.announcement ? `📢 ${screen.announcement} · ` : ""}📍 Meeting point di pojok kiri bawah · 🗓️ Jadwal lengkap di papan kiri · ℹ️ Info & denah di papan kanan
            </span>
          </div>
        </div>
      ),
    },
    // Hanging banners on both sides of the screen.
    ...[0, 1].map((i) => ({
      key: `aula-flag-${i}`,
      x: i === 0 ? room.width / 2 - ledW / 2 - 2.6 : room.width / 2 + ledW / 2 + 0.6,
      y: -3.3,
      z: 0.2,
      node: (
        <div className="fr-aula-flag" style={{ width: 2 * T, height: 2.7 * T, ["--c" as string]: room.color }}>
          <b>{i === 0 ? "SELAMAT DATANG" : "RAIH KARIER"}</b>
          <span>{i === 0 ? "🏛️" : "🚀"}</span>
        </div>
      ),
    })),
    {
      key: "aula-rundown",
      x: AULA.rundown.x - 0.1,
      y: AULA.rundown.y + AULA.rundown.height - 3.7,
      z: AULA.rundown.y + AULA.rundown.height,
      onClick: on.rundown,
      title: on.rundown ? "Jadwal acara" : undefined,
      node: (
        <div className="fr-board" style={{ width: (AULA.rundown.width + 0.2) * T, height: 3.7 * T, ["--c" as string]: room.color }}>
          <div className="fr-board-head">🗓️ JADWAL ACARA</div>
          <ul>
            {screen.rundown.slice(0, 7).map((e) => (
              <li key={e.start + e.title} data-on={e.on ? "" : undefined}>
                <i>{e.start}</i> {e.title}
              </li>
            ))}
          </ul>
          <div className="fr-board-foot">ketuk untuk jadwal lengkap</div>
        </div>
      ),
    },
    {
      key: "aula-info",
      x: AULA.info.x - 0.1,
      y: AULA.info.y + AULA.info.height - 3.7,
      z: AULA.info.y + AULA.info.height,
      onClick: on.info,
      title: on.info ? "Info & denah" : undefined,
      node: (
        <div className="fr-board" style={{ width: (AULA.info.width + 0.2) * T, height: 3.7 * T, ["--c" as string]: "#1e3a8a" }}>
          <div className="fr-board-head">ℹ️ INFO & DENAH</div>
          <ul>
            {[...stops].reverse().map((s) => (
              <li key={s.floorId}>
                <i>{s.level + 1}</i> {s.emoji} {s.label}
              </li>
            ))}
          </ul>
          <div className="fr-board-foot">FAQ · kontak panitia</div>
        </div>
      ),
    },
    {
      key: "aula-meet",
      x: AULA.meet.x,
      y: AULA.meet.y,
      z: 0.4,
      ground: true,
      onClick: on.meet,
      title: on.meet ? "Meeting point" : undefined,
      node: (
        <div className="fr-meet" style={{ width: AULA.meet.width * T, height: AULA.meet.height * T }}>
          <span>MEETING POINT</span>
        </div>
      ),
    },
    {
      key: "aula-meet-pole",
      x: AULA.pole.x + AULA.pole.width / 2 - 1.1,
      y: AULA.pole.y + AULA.pole.height - 2.9,
      z: AULA.pole.y + AULA.pole.height,
      onClick: on.meet,
      title: on.meet ? "Meeting point" : undefined,
      node: (
        <svg width={2.2 * T} height={2.9 * T} style={{ display: "block", overflow: "visible" }}>
          <rect x={1.1 * T - 4} y={34} width={8} height={2.9 * T - 40} fill="#64748b" {...ink} strokeWidth={1.4} />
          <ellipse cx={1.1 * T} cy={2.9 * T - 5} rx={18} ry={5} fill="#475569" {...ink} strokeWidth={1.2} />
          <rect x={4} y={0} width={2.2 * T - 8} height={40} rx={8} fill="#16a34a" {...ink} />
          <text x={1.1 * T} y={17} textAnchor="middle" fontSize={11} fontWeight={900} fill="#fff" fontFamily={font}>
            📍 MEETING
          </text>
          <text x={1.1 * T} y={32} textAnchor="middle" fontSize={11} fontWeight={900} fill="#fff" fontFamily={font}>
            POINT
          </text>
        </svg>
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

/** The consultation lounge: a booth per consultant along the back wall (name sign, glass sides, a desk
 *  with a phone), coffee tables between the sofas, a big wall sign, and the price board. */
export function loungeExtras(room: FairRoom, on: { consult?: (i: number) => void; board?: () => void } = {}): SceneExtra[] {
  const pw = LOUNGE.podW * T;
  const consultants = (room.consultants ?? []).slice(0, LOUNGE.pods.length);
  return [
    {
      key: "lounge-sign",
      x: room.width / 2 - 5,
      y: -3.4,
      z: 0.2,
      node: (
        <div className="fr-lounge-sign" style={{ width: 10 * T, height: 1.4 * T, ["--c" as string]: room.color }}>
          <b>🛋️ LOUNGE KONSULTASI</b>
          <span>Telepon HR & konsultan karier · ngobrol santai di sofa</span>
        </div>
      ),
    },
    ...consultants.flatMap((c, i): SceneExtra[] => {
      const x = LOUNGE.pods[i]!;
      const click = on.consult ? () => on.consult!(i) : undefined;
      const title = click ? `Konsultasi dengan ${c.name}` : undefined;
      return [
        {
          key: `pod-${c.id}`,
          x,
          y: -1.9,
          z: 0.8,
          onClick: click,
          title,
          node: (
            <svg width={pw} height={4.7 * T} style={{ display: "block", overflow: "visible" }}>
              {/* Back panel in the consultant's colour with their name sign. */}
              <rect x={4} y={0} width={pw - 8} height={2.7 * T} rx={6} fill="#f8fafc" {...ink} />
              <rect x={4} y={0} width={pw - 8} height={44} rx={6} fill={c.color} {...ink} />
              <text x={pw / 2} y={20} textAnchor="middle" fontSize={15} fontWeight={900} fill="#fff" fontFamily={font}>
                {c.emoji} {c.name}
              </text>
              <text x={pw / 2} y={36} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" opacity={0.9} fontFamily={font}>
                {c.role}
                {c.org ? ` · ${c.org}` : ""}
              </text>
              {/* Topics on a small board, and an "available" lamp. */}
              <g transform={`translate(${pw - 120}, 54)`}>
                <rect width={100} height={56} rx={4} fill="#fff" {...ink} strokeWidth={1.4} />
                {c.topics.slice(0, 3).map((t, k) => (
                  <text key={t} x={6} y={15 + k * 15} fontSize={8.5} fontWeight={700} fill={INK} fontFamily={font}>
                    • {t.length > 19 ? `${t.slice(0, 18)}…` : t}
                  </text>
                ))}
              </g>
              <g transform="translate(24, 62)">
                <rect width={74} height={22} rx={11} fill="#dcfce7" {...ink} strokeWidth={1.4} />
                <circle cx={13} cy={11} r={5} fill="#16a34a" className="fr-avail" />
                <text x={24} y={15} fontSize={10} fontWeight={900} fill="#166534" fontFamily={font}>
                  TERSEDIA
                </text>
              </g>
              {/* Glass partitions on both sides. */}
              {[6, pw - 14].map((gx) => (
                <rect key={gx} x={gx} y={2.2 * T} width={8} height={2.4 * T} rx={3} fill="#bae6fd" opacity={0.7} {...ink} strokeWidth={1.2} />
              ))}
            </svg>
          ),
        },
        {
          key: `pod-desk-${c.id}`,
          x: x + LOUNGE.podW / 2 - 1.6,
          y: 1.75,
          z: 2.65,
          onClick: click,
          title,
          node: (
            <svg width={3.2 * T} height={1.0 * T} style={{ display: "block", overflow: "visible" }}>
              <rect x={0} y={10} width={3.2 * T} height={18} rx={4} fill="#e7d3b5" {...ink} />
              <rect x={4} y={28} width={3.2 * T - 8} height={1.0 * T - 28} fill="#a16207" {...ink} />
              {/* Laptop and desk phone. */}
              <rect x={22} y={-2} width={34} height={20} rx={2} fill="#334155" {...ink} strokeWidth={1.3} />
              <rect x={25} y={1} width={28} height={13} rx={1} fill={c.color} opacity={0.75} />
              <rect x={3.2 * T - 52} y={6} width={30} height={14} rx={4} fill="#1f2937" {...ink} strokeWidth={1.3} />
              <path d={`M${3.2 * T - 48} 7q11 -12 22 0`} fill="none" stroke="#1f2937" strokeWidth={5} strokeLinecap="round" />
              <text x={1.6 * T} y={44} textAnchor="middle" fontSize={10} fontWeight={900} fill="#fff" fontFamily={font}>
                📞 KONSULTASI
              </text>
            </svg>
          ),
        },
      ];
    }),
    ...LOUNGE.rows.flatMap((y) =>
      LOUNGE.groups.map(
        (cx): SceneExtra => ({
          key: `coffee-${cx}-${y}`,
          x: cx - 1,
          y: y + 1.1,
          z: y + 2.2,
          node: (
            <svg width={2 * T} height={1.2 * T} style={{ display: "block", overflow: "visible" }}>
              <ellipse cx={T} cy={0.75 * T} rx={T - 6} ry={0.38 * T} fill="#000" opacity={0.15} />
              <ellipse cx={T} cy={0.6 * T} rx={T - 8} ry={0.36 * T} fill="#78350f" {...ink} />
              <ellipse cx={T} cy={0.55 * T} rx={T - 14} ry={0.28 * T} fill="#92400e" />
              <rect x={T - 22} y={0.42 * T} width={10} height={11} rx={2} fill="#fff" {...ink} strokeWidth={1.1} />
              <rect x={T + 12} y={0.46 * T} width={10} height={11} rx={2} fill="#fff" {...ink} strokeWidth={1.1} />
              <circle cx={T} cy={0.44 * T} r={7} fill="#22c55e" {...ink} strokeWidth={1.1} />
            </svg>
          ),
        }),
      ),
    ),
    {
      key: "lounge-board",
      x: LOUNGE.board.x - 0.1,
      y: LOUNGE.board.y + LOUNGE.board.height - 3.7,
      z: LOUNGE.board.y + LOUNGE.board.height,
      onClick: on.board,
      title: on.board ? "Tarif telepon" : undefined,
      node: (
        <div className="fr-board" style={{ width: (LOUNGE.board.width + 0.2) * T, height: 3.7 * T, ["--c" as string]: room.color }}>
          <div className="fr-board-head">📞 TARIF TELEPON</div>
          <ul>
            {LOUNGE_PLANS.map((p) => (
              <li key={p.minutes}>
                <i>{p.minutes} mnt</i> konsultan {price(`consult.${p.minutes}`)}🪙 · sesama {price(`call.${p.minutes}`)}🪙
              </li>
            ))}
            <li>Panggilan berhenti otomatis saat waktu habis</li>
          </ul>
          <div className="fr-board-foot">ketuk untuk info</div>
        </div>
      ),
    },
  ];
}

/** A promoter's pull-up banner and a small sampling table, next to where they stand. */
export function promoterExtras(p: Promoter, onClick?: () => void): SceneExtra[] {
  const w = 1.4 * T;
  const h = 2.3 * T;
  return [
    {
      key: `${p.id}-banner`,
      x: p.x + 0.55,
      y: p.y - 2.2,
      z: p.y - 0.1,
      onClick,
      title: onClick ? `Promo ${p.brand}` : undefined,
      node: (
        <div className="fr-promoter" style={{ width: w, height: h, ["--c" as string]: p.color }}>
          <span className="fr-promoter-head">
            <span className="fr-promoter-tag">PROMO</span>
            <span className="fr-promoter-emoji">{p.emoji}</span>
            <b>{p.brand}</b>
          </span>
          <span className="fr-promoter-line">{p.headline}</span>
          <span className="fr-promoter-foot" />
        </div>
      ),
    },
  ];
}
