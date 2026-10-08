"use client";
// The job fair room: the hall's back wall, company booths (back panel, desk, roll-up banner),
// the organisers' info desk, and the popups for reading vacancies and applying.
import { type CSSProperties, type FormEvent, memo, useEffect, useId, useState } from "react";
import { BOOTH_H, BOOTH_W, type BoothTheme, type CompanyBooth, type GateStyle, type JobPosting, SPONSOR_H, SPONSOR_W, type SponsorView, VIP_WING, boothFrame, boothHasGate, openJobs } from "@vwo/shared";
import { boothAccessoryExtras } from "./BoothDecor";
import type { SceneExtra } from "./CafeScene";
import { INK } from "./Furniture";

const ink = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const T = 48;

/** The back wall of an exhibition hall: panels, the event banner, bunting and spotlights. */
export function HallWall({
  w,
  h,
  title,
  subtitle = "Temukan karier impianmu · Gratis untuk semua pencari kerja",
  sponsors = [],
  banner = true,
}: {
  w: number;
  h: number;
  title: string;
  subtitle?: string;
  sponsors?: SponsorView[];
  /** False for rooms that hang their own screen or board on the wall. */
  banner?: boolean;
}) {
  const bw = Math.min(520, w * 0.5);
  const flags = Math.ceil(w / 26);
  const colors = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>
      <div className="rpg-hallwall" style={{ position: "absolute", inset: 0 }} />
      <div className="rpg-hallbase" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: h * 0.18 }} />
      <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {/* Spotlights on the ceiling rail. */}
        <rect x={0} y={4} width={w} height={6} fill="#334155" />
        {Array.from({ length: Math.floor(w / 160) }, (_, i) => {
          const x = 80 + i * 160;
          return (
            <g key={i}>
              <path d={`M${x - 7} 8h14l-3 12h-8Z`} fill="#1f2937" {...ink} strokeWidth={1.4} />
              <path d={`M${x - 5} 20L${x - 40} ${h}H${x + 40}L${x + 5} 20Z`} fill="#fff7d6" opacity={0.12} />
            </g>
          );
        })}
        {/* Bunting. */}
        <path d={`M0 16${Array.from({ length: Math.ceil(w / 130) }, (_, i) => `Q${i * 130 + 65} 32 ${(i + 1) * 130} 16`).join("")}`} fill="none" stroke={INK} strokeWidth={1.4} />
        {Array.from({ length: flags }, (_, i) => {
          const x = i * 26 + 10;
          const t = (x % 130) / 130;
          const y = 16 + Math.sin(t * Math.PI) * 8;
          return <path key={i} d={`M${x - 7} ${y}h14l-7 13Z`} fill={colors[i % colors.length]} stroke={INK} strokeWidth={1} />;
        })}
        {/* The event banner. */}
        {banner && (
          // Kept short so it clears the VIP banners and gates of the booths standing right below it.
          <g transform={`translate(${(w - bw) / 2}, 22)`}>
            <rect x={0} y={0} width={bw} height={46} rx={8} fill="#1e3a8a" {...ink} />
            <rect x={5} y={5} width={bw - 10} height={36} rx={5} fill="none" stroke="#fbbf24" strokeWidth={1.6} strokeDasharray="6 4" />
            <text x={bw / 2} y={25} textAnchor="middle" fontSize={19} fontWeight={900} fill="#fff" fontFamily="system-ui, sans-serif" letterSpacing={1}>
              {title.toUpperCase().slice(0, 34)}
            </text>
            <text x={bw / 2} y={38} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fde68a" fontFamily="system-ui, sans-serif">
              {subtitle.slice(0, 70)}
            </text>
          </g>
        )}
      </svg>
      {banner && sponsors.length > 0 && (
        <>
          <SponsorStrip sponsors={sponsors.slice(0, Math.ceil(sponsors.length / 2))} style={{ right: (w + bw) / 2 + 16, top: 26 }} />
          <SponsorStrip sponsors={sponsors.slice(Math.ceil(sponsors.length / 2))} style={{ left: (w + bw) / 2 + 16, top: 26 }} />
        </>
      )}
    </div>
  );
}

/** "Didukung oleh" plate with sponsor logos, hung on the hall wall. */
function SponsorStrip({ sponsors, style }: { sponsors: SponsorView[]; style: CSSProperties }) {
  return (
    <div className="jb-strip" style={style}>
      <div className="jb-strip-title">Didukung oleh</div>
      <div className="jb-strip-logos">
        {sponsors.map((sp) => (
          <span key={sp.id} className="jb-strip-logo" style={{ ["--c" as string]: sp.color }}>
            <b>{sp.logo}</b> {sp.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A sponsor's standing banner on the hall floor. */
function SponsorStand({ sponsor }: { sponsor: SponsorView }) {
  return (
    <div className="jb-stand" style={{ width: SPONSOR_W * T + 8, height: 2.6 * T, ["--c" as string]: sponsor.color }}>
      {sponsor.imageUrl ? (
        <img src={sponsor.imageUrl} alt={sponsor.name} />
      ) : (
        <>
          <div className="jb-stand-tier">{sponsor.tier.toUpperCase()} SPONSOR</div>
          <div className="jb-stand-logo">{sponsor.logo}</div>
          <div className="jb-stand-name">{sponsor.name}</div>
          <div className="jb-stand-tag">{sponsor.tagline}</div>
          {sponsor.promo && <div className="jb-stand-promo">PROMO</div>}
        </>
      )}
    </div>
  );
}

export function sponsorExtras(sponsor: SponsorView, onClick?: () => void): SceneExtra {
  return {
    key: `sponsor-${sponsor.id}`,
    x: sponsor.x - 4 / T,
    y: sponsor.y + SPONSOR_H - 2.6,
    z: sponsor.y + SPONSOR_H,
    node: <SponsorStand sponsor={sponsor} />,
    onClick,
    title: onClick ? `Sponsor ${sponsor.name}` : undefined,
  };
}

/** A sponsor's details: what they do, their promo, and their website. */
export function SponsorCard({ sponsor, onClose }: { sponsor: SponsorView; onClose: () => void }) {
  useEscape(onClose);
  return (
    <div className="mb-backdrop" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
      <div className="rpg-box mb jb-form" role="dialog" aria-label={`Sponsor ${sponsor.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-head">
          <span className="mb-title">⭐ Sponsor</span>
          <button type="button" className="mb-close" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="mb-page jb-page" style={{ ["--c" as string]: sponsor.color }}>
          <div className="jb-job">
            <div className="jb-job-head" style={{ ["--c" as string]: sponsor.color }}>
              <div>
                <div className="jb-job-title">{sponsor.name}</div>
                <div className="jb-job-co">{sponsor.tagline}</div>
              </div>
              <span className="jb-badge">{sponsor.tier}</span>
            </div>
            <p className="jb-about">{sponsor.about}</p>
            {sponsor.promo && <div className="jb-promo">🎁 {sponsor.promo}</div>}
            <div className="jb-job-foot">
              <a className="mb-order jb-apply jb-link" href={sponsor.website} target="_blank" rel="noopener noreferrer">
                Kunjungi website ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Logo({ booth, r }: { booth: CompanyBooth; r: number }) {
  return (
    <g>
      <circle r={r} fill="#fff" {...ink} strokeWidth={1.8} />
      <text y={r * 0.36} textAnchor="middle" fontSize={r * 0.95} fontWeight={900} fill={booth.color} fontFamily="system-ui, sans-serif">
        {booth.logo}
      </text>
    </g>
  );
}

export interface BoothRating {
  average: number;
  count: number;
  level: number;
}

const GOLD = "#eab308";

/** Wall, base strip and post colours for each booth theme. */
export const BOOTH_THEMES: Record<BoothTheme, { name: string; wall: string; base: string; post: string; dark?: boolean }> = {
  classic: { name: "Klasik", wall: "#f8fafc", base: "#e2e8f0", post: "#cbd5e1" },
  modern: { name: "Modern gelap", wall: "#1f2937", base: "#111827", post: "#0f172a", dark: true },
  wood: { name: "Kayu natural", wall: "#fdf6e3", base: "#c08a52", post: "#92400e" },
  pastel: { name: "Pastel", wall: "#fdf2f8", base: "#fbcfe8", post: "#f9a8d4" },
  neon: { name: "Neon", wall: "#0b1020", base: "#1e1b4b", post: "#312e81", dark: true },
};

/** The parts of a booth redraw only when the booth or its rating really changed, not every frame. */
const sameProps = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

/** VIP side wings: tall banners in the company colour with gold trim, framing the wider booth. */
function VipWing({ booth, side }: { booth: CompanyBooth; side: "l" | "r" }) {
  const w = VIP_WING * T;
  const h = 2.2 * T + 26;
  return (
    <g transform={`translate(${side === "l" ? 0 : 0}, -26)`}>
      <rect x={2} y={0} width={w - 4} height={h} rx={5} fill={booth.color} {...ink} strokeWidth={1.8} />
      <rect x={7} y={5} width={w - 14} height={h - 10} rx={3} fill="none" stroke={GOLD} strokeWidth={2} />
      <g transform={`translate(${w / 2}, 22)`}>
        <Logo booth={booth} r={11} />
      </g>
      <text x={w / 2} y={47} textAnchor="middle" fontSize={10} fontWeight={900} fill={GOLD} letterSpacing={1} fontFamily="system-ui, sans-serif">
        VIP
      </text>
      {/* One word per wing, written upwards so it fits the banner's height. */}
      <text
        transform={`translate(${w / 2 + 4}, ${(56 + h - 10) / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize={12}
        fontWeight={900}
        fill="#fff"
        letterSpacing={1.5}
        fontFamily="system-ui, sans-serif"
      >
        {side === "l" ? "WE’RE" : "HIRING"}
      </text>
      <rect x={-2} y={h - 8} width={w + 4} height={8} rx={2} fill={GOLD} {...ink} strokeWidth={1.2} />
    </g>
  );
}

const BoothPanel = memo(function BoothPanel({ booth, rating }: { booth: CompanyBooth; rating?: BoothRating }) {
  const premium = booth.tier === "premium";
  const wing = premium ? VIP_WING * T : 0;
  return (
    <svg width={BOOTH_W * T + 2 * wing} height={2.2 * T} style={{ display: "block", overflow: "visible" }}>
      {premium && <VipWing booth={booth} side="l" />}
      {premium && (
        <g transform={`translate(${BOOTH_W * T + wing}, 0)`}>
          <VipWing booth={booth} side="r" />
        </g>
      )}
      <g transform={`translate(${wing}, 0)`}>
        <BoothWall booth={booth} rating={rating} />
      </g>
    </svg>
  );
}, sameProps);

function BoothWall({ booth, rating }: { booth: CompanyBooth; rating?: BoothRating }) {
  const w = BOOTH_W * T;
  const h = 2.2 * T;
  const premium = booth.tier === "premium";
  const themeId = booth.theme ?? "classic";
  const theme = BOOTH_THEMES[themeId] ?? BOOTH_THEMES.classic;
  const post = premium ? GOLD : theme.post;
  const classicVip = premium && themeId === "classic";
  const open = openJobs(booth);
  return (
    <g>
      {/* Side posts. */}
      <rect x={0} y={4} width={8} height={h - 4} fill={post} {...ink} strokeWidth={1.6} />
      <rect x={w - 8} y={4} width={8} height={h - 4} fill={post} {...ink} strokeWidth={1.6} />
      {/* The wall itself. */}
      <rect x={6} y={10} width={w - 12} height={h - 12} fill={classicVip ? "#fffbeb" : theme.wall} {...ink} strokeWidth={1.8} />
      {themeId === "wood" &&
        [26, 42, 58, 74].map((py) => <path key={py} d={`M8 ${py}H${w - 8}`} stroke="#d6b88a" strokeWidth={1.2} />)}
      <rect x={6} y={h - 26} width={w - 12} height={24} fill={classicVip ? "#fde68a" : theme.base} />
      {themeId === "neon" && <rect x={10} y={14} width={w - 20} height={h - 20} rx={4} fill="none" stroke={booth.color} strokeWidth={3} className="jb-neon-edge" />}
      {premium && (
        <>
          {/* Spotlights on the posts, shining on the wall. */}
          {[14, w - 14].map((cx) => (
            <g key={cx} transform={`translate(${cx}, 38)`}>
              <g className="jb-sweep" data-side={cx < w / 2 ? "l" : "r"}>
                <path d={`M0 2L${cx < w / 2 ? 52 : -52} ${h - 42}H${cx < w / 2 ? 12 : -12}Z`} fill="url(#jb-beam)" className="jb-spot" />
              </g>
              <circle r={7} fill="#1f2937" {...ink} strokeWidth={1.4} />
              <circle cy={1} r={3.5} fill="#fef9c3" />
            </g>
          ))}
          <defs>
            <linearGradient id="jb-beam" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fef9c3" stopOpacity={0.75} />
              <stop offset="1" stopColor="#fde047" stopOpacity={0} />
            </linearGradient>
          </defs>
          <rect x={-9} y={-5} width={w + 18} height={44} rx={7} fill={GOLD} {...ink} />
          {/* Chasing marquee bulbs along the gold frame. */}
          {Array.from({ length: 22 }, (_, i) => (
            <circle key={i} cx={-3 + (i * (w + 6)) / 21} cy={36} r={2.3} className="jb-bulb" data-odd={i % 2 ? "" : undefined} />
          ))}
        </>
      )}
      {/* Fascia with the company name. */}
      <rect x={-4} y={0} width={w + 8} height={34} rx={4} fill={booth.color} {...ink} />
      {premium && (
        <>
          {/* A running LED ticker under the name. */}
          <rect x={50} y={40} width={w - 60} height={13} rx={2} fill="#0b0f19" {...ink} strokeWidth={1.2} />
          <foreignObject x={52} y={40} width={w - 64} height={13}>
            <div className="jb-led">
              <span>
                ★ {booth.ticker?.trim() ? booth.ticker.toUpperCase() : `${booth.company.toUpperCase()} · ${open.length} LOWONGAN DIBUKA · ${booth.tagline.toUpperCase()} · INTERVIEW LANGSUNG DI STAND`} ★
              </span>
            </div>
          </foreignObject>
          <g transform="translate(30, 46.5)">
            <g className="jb-crown">
              <rect x={-21} y={-9} width={42} height={18} rx={9} fill="#111827" stroke={GOLD} strokeWidth={2} />
              <text x={0} y={4.5} textAnchor="middle" fontSize={11} fontWeight={900} fill={GOLD} letterSpacing={2} fontFamily="system-ui, sans-serif">
                VIP
              </text>
            </g>
          </g>
        </>
      )}
      <g transform="translate(24, 17)">
        <Logo booth={booth} r={13} />
      </g>
      <text x={44} y={23} fontSize={16} fontWeight={900} fill="#fff" fontFamily="system-ui, sans-serif">
        {booth.company}
      </text>
      {rating ? (
        <g transform={`translate(${w - 8}, 17)`}>
          <rect x={-92} y={-11} width={92} height={22} rx={11} fill="#fff" {...ink} strokeWidth={1.4} />
          <text x={-46} y={4.5} textAnchor="middle" fontSize={11} fontWeight={900} fill={INK} fontFamily="system-ui, sans-serif">
            <tspan fill="#eab308">★</tspan> {rating.average.toFixed(1)} · Lv {rating.level}
          </text>
        </g>
      ) : (
        <text x={w - 12} y={22} textAnchor="end" fontSize={10} fontWeight={700} fill="#fff" opacity={0.85} fontFamily="system-ui, sans-serif">
          {booth.industry}
        </text>
      )}
      {/* Posters. */}
      <g transform={`translate(18, ${premium ? 56 : 42})`}>
        <rect width={104} height={50} rx={4} fill="#fff" {...ink} strokeWidth={1.4} />
        <rect width={104} height={12} rx={3} fill={booth.color} opacity={0.85} />
        <foreignObject x={4} y={13} width={96} height={36}>
          <div className="jb-poster">{booth.tagline}</div>
        </foreignObject>
      </g>
      {!premium && (
      <g transform="translate(134, 42)">
        <rect width={96} height={50} rx={4} fill="#fef3c7" {...ink} strokeWidth={1.4} />
        <text x={48} y={22} textAnchor="middle" fontSize={13} fontWeight={900} fill={INK} fontFamily="system-ui, sans-serif">
          {open.length ? "KAMI" : "TERIMA"}
        </text>
        <text x={48} y={39} textAnchor="middle" fontSize={13} fontWeight={900} fill={booth.color} fontFamily="system-ui, sans-serif">
          {open.length ? "MEREKRUT!" : "KASIH!"}
        </text>
      </g>
      )}
      {/* A small screen; VIP booths have a big video wall instead. */}
      {!premium && (
        <g transform={`translate(${w - 50}, 46)`}>
          <rect width={34} height={24} rx={3} fill="#1f2937" {...ink} strokeWidth={1.4} />
          <rect x={3} y={3} width={28} height={18} rx={2} fill={booth.color} opacity={0.7} />
          <path d="M13 8l8 4-8 4Z" fill="#fff" />
          <rect x={15} y={24} width={4} height={10} fill="#64748b" />
        </g>
      )}
    </g>
  );
}

/** A VIP booth's big screen on the wall; tapping it plays the company video. */
const VideoWall = memo(function VideoWall({ booth }: { booth: CompanyBooth }) {
  const w = 150;
  const h = 66;
  const id = useId().replace(/:/g, "");
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={booth.color} />
          <stop offset="1" stopColor="#0b1020" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} rx={5} fill="#0b0f19" {...ink} strokeWidth={1.8} />
      <rect x={5} y={5} width={w - 10} height={h - 10} rx={3} fill={`url(#${id}s)`} />
      <text x={12} y={20} fontSize={9} fontWeight={900} fill="#fff" opacity={0.85} fontFamily="system-ui, sans-serif">
        {booth.company.toUpperCase().slice(0, 22)}
      </text>
      <g transform={`translate(${w / 2}, ${h / 2 + 4})`}>
        <circle r={14} fill="#fff" opacity={0.92} {...ink} strokeWidth={1.4} />
        <path d="M-4 -7L8 0L-4 7Z" fill={booth.color} />
      </g>
      <rect x={w - 44} y={h - 18} width={36} height={11} rx={5.5} fill="#dc2626" />
      <text x={w - 26} y={h - 9.6} textAnchor="middle" fontSize={7.5} fontWeight={900} fill="#fff" fontFamily="system-ui, sans-serif">
        VIDEO
      </text>
      <rect x={w / 2 - 3} y={h} width={6} height={6} fill="#475569" />
    </svg>
  );
}, sameProps);

/** Gate styles a booth can pick, with their names. */
export const GATE_STYLES: Record<GateStyle, string> = { klasik: "Klasik", janur: "Janur & bambu", balon: "Lengkung balon", neon: "Neon" };

/** The beam sits just above the booth's header; the posts stand at the front corners of the carpet. */
const BEAM_H = 34;
const POST_H = 62;

const gateLook = (booth: CompanyBooth) => {
  const style: GateStyle = booth.media?.gate ?? (booth.tier === "premium" ? "klasik" : "janur");
  const dark = style === "neon";
  const fill = style === "janur" ? "#d9a441" : dark ? "#0b1020" : booth.color;
  return { style, dark, fill };
};

/** The gate's beam with its name plate, drawn behind the booth so it never hides the booth itself. */
const GateBeam = memo(function GateBeam({ booth, width }: { booth: CompanyBooth; width: number }) {
  const w = width * T;
  const { style, dark, fill } = gateLook(booth);
  // A "We're hiring" neon hangs on the beam's left half, where it would otherwise clash with the name plate.
  const neon = !!booth.accessories?.includes("neon");
  const inner = booth.tier === "premium" ? VIP_WING * T + 6 : 24;
  const neonW = 112;
  const left = neon ? inner + neonW + 8 : 30;
  const room = w - left - (neon ? inner : 30);
  const text = (booth.media?.gateText?.trim() || `Selamat datang di ${booth.company}`).slice(0, Math.max(6, Math.floor((room - 20) / 6.6)));
  const plateW = Math.min(room, text.length * 6.6 + 20);
  const plateX = left + room / 2;
  const leg = 18;
  return (
    <svg width={w} height={BEAM_H} style={{ display: "block", overflow: "visible" }}>
      {style === "balon" ? (
        Array.from({ length: Math.floor(w / 15) + 1 }, (_, i) => i / Math.floor(w / 15)).map((t, i) => (
          <circle key={i} cx={6 + t * (w - 12)} cy={14 - Math.sin(t * Math.PI) * 8} r={9} fill={i % 3 === 0 ? "#facc15" : i % 2 ? "#fff" : booth.color} {...ink} strokeWidth={1.2} />
        ))
      ) : (
        <g>
          <rect x={2} y={10} width={leg} height={BEAM_H - 10} fill={fill} {...ink} strokeWidth={1.6} />
          <rect x={w - leg - 2} y={10} width={leg} height={BEAM_H - 10} fill={fill} {...ink} strokeWidth={1.6} />
          <rect x={-6} y={4} width={w + 12} height={16} rx={4} fill={style === "janur" ? "#b45309" : dark ? "#0b1020" : booth.color} {...ink} strokeWidth={1.8} />
          {style === "klasik" && <rect x={-6} y={18} width={w + 12} height={4} fill={GOLD} />}
          {style === "neon" && <rect x={-2} y={8} width={w + 4} height={8} rx={4} fill="none" stroke={booth.color} strokeWidth={2.5} className="jb-neon-edge" />}
          {style === "janur" && (
            <g fill="none" strokeWidth={2.5} strokeLinecap="round">
              {Array.from({ length: Math.floor(w / 28) }, (_, i) => (
                <path key={i} d={`M${14 + i * 28} 20q6 10 0 18`} stroke={i % 2 ? "#facc15" : "#84cc16"} />
              ))}
            </g>
          )}
        </g>
      )}
      {neon && (
        <g transform={`translate(${inner}, 1)`} style={{ ["--c" as string]: booth.color }}>
          <rect width={neonW} height={22} rx={6} fill="#0b1020" stroke={booth.color} strokeWidth={2} className="jb-neon-edge" />
          <text x={neonW / 2} y={15} textAnchor="middle" fontSize={11} fontWeight={900} letterSpacing={1.2} fill="#fff" fontFamily="system-ui, sans-serif" style={{ textShadow: `0 0 4px ${booth.color}, 0 0 8px ${booth.color}` }}>
            WE&apos;RE HIRING
          </text>
        </g>
      )}
      <g transform={`translate(${plateX}, 12)`}>
        <rect x={-plateW / 2} y={-12} width={plateW} height={24} rx={6} fill={dark ? "#0b1020" : "#fff"} stroke={dark ? booth.color : INK} strokeWidth={dark ? 2.5 : 1.8} />
        <text y={4} textAnchor="middle" fontSize={11} fontWeight={900} fill={dark ? "#fff" : booth.color} fontFamily="system-ui, sans-serif">
          {text}
        </text>
      </g>
    </svg>
  );
}, sameProps);

/** The gate's two posts at the front corners of the booth: short enough to keep the desk and screen in view. */
const GatePosts = memo(function GatePosts({ booth, width }: { booth: CompanyBooth; width: number }) {
  const w = width * T;
  const { style, fill } = gateLook(booth);
  const post = 20;
  return (
    <svg width={w} height={POST_H} style={{ display: "block", overflow: "visible" }}>
      {[3, w - post - 3].map((px) => (
        <g key={px} transform={`translate(${px}, 0)`}>
          {style === "balon" ? (
            [0, 1, 2, 3].map((i) => <circle key={i} cx={post / 2} cy={POST_H - 9 - i * 15} r={9} fill={i % 2 ? "#fff" : booth.color} {...ink} strokeWidth={1.2} />)
          ) : (
            <>
              <rect x={0} y={8} width={post} height={POST_H - 8} rx={3} fill={fill} {...ink} strokeWidth={1.8} />
              {style === "klasik" && (
                <>
                  <rect x={-3} y={POST_H - 10} width={post + 6} height={10} rx={2} fill={GOLD} {...ink} strokeWidth={1.4} />
                  <circle cx={post / 2} cy={6} r={7} fill={GOLD} {...ink} strokeWidth={1.4} />
                </>
              )}
              {style === "janur" && (
                <>
                  {[22, 38].map((py) => (
                    <path key={py} d={`M1 ${py}h${post - 2}`} stroke="#92400e" strokeWidth={2} />
                  ))}
                  <path d={`M${post / 2} 8q-12 -14 -4 -30`} fill="none" stroke="#65a30d" strokeWidth={3} strokeLinecap="round" />
                  <path d={`M${post / 2} 8q10 -16 2 -34`} fill="none" stroke="#facc15" strokeWidth={3} strokeLinecap="round" />
                </>
              )}
              {style === "neon" && <rect x={5} y={13} width={post - 10} height={POST_H - 18} rx={4} fill="none" stroke={booth.color} strokeWidth={3} className="jb-neon-edge" />}
            </>
          )}
        </g>
      ))}
    </svg>
  );
}, sameProps);

const BoothDesk = memo(function BoothDesk({ booth }: { booth: CompanyBooth }) {
  const w = 3 * T;
  const top = 22;
  const h = 1.55 * T;
  return (
    <svg width={w + 8} height={h} style={{ display: "block", overflow: "visible" }}>
      <rect x={0} y={0} width={w + 8} height={top} rx={4} fill="#f1f5f9" {...ink} />
      {/* Brochures and a laptop. */}
      <rect x={14} y={4} width={16} height={12} rx={1} fill={booth.color} {...ink} strokeWidth={1.2} transform="rotate(-8 22 10)" />
      <rect x={26} y={5} width={16} height={12} rx={1} fill="#fff" {...ink} strokeWidth={1.2} transform="rotate(6 34 11)" />
      <path d={`M${w - 52} 16h38l-4 -12h-30Z`} fill="#94a3b8" {...ink} strokeWidth={1.3} />
      <rect x={w - 60} y={14} width={52} height={5} rx={2} fill="#cbd5e1" {...ink} strokeWidth={1.2} />
      <rect x={w / 2 - 8} y={6} width={18} height={10} rx={2} fill="#fde68a" {...ink} strokeWidth={1.2} />
      {/* Front skirt in the company colour. */}
      <rect x={2} y={top} width={w + 4} height={h - top} fill={booth.color} {...ink} />
      <rect x={2} y={h - 10} width={w + 4} height={10} fill="#000" opacity={0.18} />
      <g transform={`translate(${(w + 8) / 2}, ${top + (h - top) / 2 - 2})`}>
        <Logo booth={booth} r={16} />
      </g>
    </svg>
  );
}, sameProps);

const RollUp = memo(function RollUp({ booth }: { booth: CompanyBooth }) {
  const w = 50;
  const h = 2.5 * T;
  return (
    <div className="jb-rollup" style={{ width: w, height: h, ["--c" as string]: booth.color }}>
      <div className="jb-rollup-head">LOWONGAN</div>
      {openJobs(booth).slice(0, 3).map((j) => (
        <div key={j.id} className="jb-rollup-job">
          {j.title}
        </div>
      ))}
      <div className="jb-rollup-foot">{booth.logo}</div>
    </div>
  );
}, sameProps);

/** Everything that draws one booth, in scene coordinates. */
export function boothExtras(booth: CompanyBooth, opts: { onBanner?: () => void; onDesk?: () => void; onAccessory?: (id: string) => void; visitors?: number; rating?: BoothRating } = {}): SceneExtra[] {
  const { x, y } = booth;
  const f = boothFrame(booth);
  const premium = booth.tier === "premium";
  const onTv = opts.onAccessory ? () => opts.onAccessory!("tv") : undefined;
  return [
    {
      key: `${booth.id}-carpet`,
      x: f.x + 0.1,
      y: y + 0.5,
      z: 0,
      ground: true,
      node: <div className="jb-carpet" data-premium={premium ? "" : undefined} data-theme={booth.theme ?? "classic"} style={{ width: (f.width - 0.2) * T, height: (BOOTH_H - 0.5) * T, ["--c" as string]: booth.color }} />,
    },
    ...(booth.tier === "premium"
      ? [
          {
            key: `${booth.id}-pool`,
            x: f.x + 0.1,
            y: y + 0.5,
            z: 0.5,
            ground: true,
            node: (
              <div className="jb-pools" style={{ width: (f.width - 0.2) * T, height: (BOOTH_H - 0.5) * T }}>
                <span />
                <span />
              </div>
            ),
          },
        ]
      : []),
    { key: `${booth.id}-panel`, x: f.x, y: y - 1.7, z: y + 0.5, node: <BoothPanel booth={booth} rating={opts.rating} /> },
    ...(premium
      ? [{ key: `${booth.id}-videowall`, x: x + 134 / T, y: y - 1.7 + 40 / T, z: y + 0.55, node: <VideoWall booth={booth} />, onClick: onTv, title: onTv ? `Tonton video ${booth.company}` : undefined }]
      : []),
    ...(boothHasGate(booth)
      ? [
          { key: `${booth.id}-gate`, x: f.x, y: y - 1.7 - (BEAM_H + 8) / T, z: y + 0.45, node: <GateBeam booth={booth} width={f.width} />, ...(booth.accessories?.includes("neon") && opts.onAccessory ? { onClick: () => opts.onAccessory!("neon"), title: `Papan lowongan ${booth.company}` } : {}) },
          { key: `${booth.id}-gateposts`, x: f.x, y: y + BOOTH_H - POST_H / T, z: y + BOOTH_H, node: <GatePosts booth={booth} width={f.width} /> },
        ]
      : []),
    {
      key: `${booth.id}-desk`,
      x: x + 1.2 - 4 / T,
      y: y + 1.15,
      z: y + 2.7,
      node: <BoothDesk booth={booth} />,
      onClick: opts.onDesk,
      title: opts.onDesk ? `Meja ${booth.company}` : undefined,
    },
    {
      key: `${booth.id}-rollup`,
      x: x + 4.8,
      y: y + 2.1 - 2.5,
      z: y + 2.1,
      node: <RollUp booth={booth} />,
      onClick: opts.onBanner,
      title: opts.onBanner ? `Lowongan ${booth.company}` : undefined,
    },
    ...boothAccessoryExtras(booth, opts.onAccessory),
  ];
}

/** A free booth place: a taped-out floor and a sign inviting a company to book it. */
export function emptyBoothExtras(slot: { floor: number; x: number; y: number }, onClick?: () => void): SceneExtra[] {
  const { x, y } = slot;
  const key = `empty-${slot.floor}-${x}-${y}`;
  const title = onClick ? "Stand kosong: booking stand" : "Stand kosong";
  return [
    {
      key: `${key}-floor`,
      x: x + 0.1,
      y: y + 0.5,
      z: 0,
      ground: true,
      onClick,
      title,
      node: (
        <div className="jb-empty" style={{ width: (BOOTH_W - 0.2) * T, height: (BOOTH_H - 0.5) * T }}>
          <span>{onClick ? "＋ BOOKING STAND" : "STAND KOSONG"}</span>
        </div>
      ),
    },
    {
      key: `${key}-sign`,
      x: x + BOOTH_W / 2 - 1.1,
      y: y + 0.2,
      z: y + 1.6,
      onClick,
      title,
      node: (
        <svg width={2.2 * T} height={1.5 * T} viewBox="0 0 70 48" style={{ display: "block", overflow: "visible" }}>
          <path d="M14 46l6-20M56 46l-6-20" stroke="#3b2a20" strokeWidth={3} strokeLinecap="round" />
          <rect x={4} y={2} width={62} height={30} rx={5} fill="#fff" stroke="#3b2a20" strokeWidth={2.5} />
          <rect x={4} y={2} width={62} height={10} rx={5} fill="#16a34a" stroke="#3b2a20" strokeWidth={2.5} />
          <text x={35} y={10} textAnchor="middle" fontSize={7.5} fontWeight={900} fill="#fff" fontFamily="system-ui, sans-serif">
            TERSEDIA
          </text>
          <text x={35} y={22.5} textAnchor="middle" fontSize={8.5} fontWeight={900} fill="#3b2a20" fontFamily="system-ui, sans-serif">
            Stand kosong
          </text>
          <text x={35} y={30} textAnchor="middle" fontSize={6} fontWeight={700} fill="#16a34a" fontFamily="system-ui, sans-serif">
            ketuk untuk booking
          </text>
        </svg>
      ),
    },
  ];
}

/** The organisers' desk near the entrance. */
export function infoDeskExtras(desk: { x: number; y: number; width: number; height: number }, onClick?: () => void): SceneExtra[] {
  const w = desk.width * T;
  const h = 1.3 * T;
  return [
    {
      key: "info-desk",
      x: desk.x,
      y: desk.y + desk.height - 1.3,
      z: desk.y + desk.height,
      onClick,
      title: onClick ? "Meja informasi" : undefined,
      node: (
        <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
          <rect x={0} y={0} width={w} height={20} rx={4} fill="#f1f5f9" {...ink} />
          <rect x={20} y={4} width={26} height={11} rx={1} fill="#fff" {...ink} strokeWidth={1.2} />
          <rect x={w - 60} y={3} width={14} height={12} rx={2} fill="#fca5a5" {...ink} strokeWidth={1.2} />
          <rect x={2} y={20} width={w - 4} height={h - 20} fill="#1e3a8a" {...ink} />
          <rect x={2} y={h - 9} width={w - 4} height={9} fill="#000" opacity={0.2} />
          <text x={w / 2} y={h / 2 + 14} textAnchor="middle" fontSize={13} fontWeight={800} fill="#fde68a" fontFamily="system-ui, sans-serif">
            ℹ INFORMASI · DENAH · BANTUAN
          </text>
        </svg>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------------------------
// Popups.

function useEscape(onClose: () => void, extra?: (e: KeyboardEvent) => boolean) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code === "Escape") onClose();
      else if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        e.stopImmediatePropagation();
        return;
      } else if (!extra?.(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  });
}

function JobCard({ job, booth, applied, onApply }: { job: JobPosting; booth: CompanyBooth; applied: boolean; onApply?: (job: JobPosting) => void }) {
  return (
    <div className="jb-job">
      <div className="jb-job-head" style={{ ["--c" as string]: booth.color }}>
        <div>
          <div className="jb-job-title">{job.title}</div>
          <div className="jb-job-co">{booth.company}</div>
        </div>
        <span className="jb-badge">{job.type}</span>
      </div>
      <div className="jb-facts">
        <span>📍 {job.location}</span>
        {job.salary && <span>💰 {job.salary}</span>}
        {job.deadline && <span>⏳ s.d. {new Date(`${job.deadline}T00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>}
        {job.quota ? <span>👥 {job.quota} orang</span> : null}
      </div>
      {job.description && <p className="jb-about">{job.description}</p>}
      <div className="jb-req-title">Kualifikasi</div>
      <ul className="jb-req">
        {job.requirements.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {onApply && (
        <div className="jb-job-foot">
          {applied ? (
            <span className="jb-applied">✓ Lamaran sudah terkirim</span>
          ) : (
            <button type="button" className="mb-order jb-apply" onClick={() => onApply(job)}>
              Lamar posisi ini
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type BoardPage = { kind: "about" } | { kind: "job"; job: JobPosting } | { kind: "image"; title: string; src: string };

/** A booth's hiring banner as a popup: one page per vacancy, uploaded banner photos first. */
export function JobBoard({
  booth,
  onClose,
  onApply,
  appliedJobIds = new Set(),
  startJobId,
  startAbout,
}: {
  booth: CompanyBooth;
  onClose: () => void;
  onApply?: (job: JobPosting) => void;
  appliedJobIds?: Set<string>;
  startJobId?: string;
  /** Open on the company page instead of the first vacancy. */
  startAbout?: boolean;
}) {
  const pages: BoardPage[] = [...(booth.bannerImages ?? []).map((b) => ({ kind: "image" as const, ...b })), ...openJobs(booth).map((job) => ({ kind: "job" as const, job })), { kind: "about" }];
  const [page, setPage] = useState(() =>
    startAbout
      ? pages.length - 1
      : Math.max(
          0,
          pages.findIndex((p) => p.kind === "job" && p.job.id === startJobId),
        ),
  );
  const go = (d: number) => setPage((p) => Math.min(pages.length - 1, Math.max(0, p + d)));
  useEscape(onClose, (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") go(-1);
    else if (e.code === "ArrowRight" || e.code === "KeyD") go(1);
    else return false;
    return true;
  });
  const current = pages[page];
  const tab = (p: BoardPage) => (p.kind === "job" ? p.job.title : p.kind === "image" ? p.title : "Profil perusahaan");

  return (
    <div className="mb-backdrop" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
      <div className="rpg-box mb" role="dialog" aria-label={`Lowongan ${booth.company}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-head">
          <span className="mb-title jb-board-title">
            <svg width={30} height={30} viewBox="-15 -15 30 30" aria-hidden>
              <Logo booth={booth} r={13} />
            </svg>
            Lowongan {booth.company}
          </span>
          <button type="button" className="mb-close" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="mb-tabs">
          {pages.map((p, i) => (
            <button key={i} type="button" data-active={i === page ? "" : undefined} onClick={() => setPage(i)}>
              {tab(p)}
            </button>
          ))}
        </div>
        <div className="mb-page jb-page" style={{ ["--c" as string]: booth.color }}>
          {current?.kind === "image" ? (
            <img className="mb-image" src={current.src} alt={current.title} />
          ) : current?.kind === "job" ? (
            <JobCard job={current.job} booth={booth} applied={appliedJobIds.has(current.job.id)} onApply={onApply} />
          ) : (
            <div className="jb-job">
              <div className="jb-job-head" style={{ ["--c" as string]: booth.color }}>
                <div>
                  <div className="jb-job-title">{booth.company}</div>
                  <div className="jb-job-co">
                    {booth.industry} · {booth.tagline}
                  </div>
                </div>
              </div>
              <p className="jb-about">{booth.about}</p>
              <dl className="jb-info">
                {booth.website && (
                  <>
                    <dt>🌐 Website</dt>
                    <dd>
                      <a href={booth.website} target="_blank" rel="noopener noreferrer">
                        {booth.website.replace(/^https?:\/\//, "")}
                      </a>
                    </dd>
                  </>
                )}
                {booth.email && (
                  <>
                    <dt>✉️ Email HR</dt>
                    <dd>
                      <a href={`mailto:${booth.email}`}>{booth.email}</a>
                    </dd>
                  </>
                )}
                {booth.phone && (
                  <>
                    <dt>📞 HR</dt>
                    <dd>
                      <a href={`tel:${booth.phone}`}>{booth.phone}</a>
                    </dd>
                  </>
                )}
                {booth.address && (
                  <>
                    <dt>📍 Kantor</dt>
                    <dd>{booth.address}</dd>
                  </>
                )}
                {booth.founded && (
                  <>
                    <dt>📅 Berdiri</dt>
                    <dd>{booth.founded}</dd>
                  </>
                )}
                {booth.employees && (
                  <>
                    <dt>👥 Karyawan</dt>
                    <dd>{booth.employees}</dd>
                  </>
                )}
                {booth.socials && booth.socials.length > 0 && (
                  <>
                    <dt>🔗 Sosial media</dt>
                    <dd>
                      {booth.socials.map((so, i) => (
                        <span key={so.url}>
                          {i > 0 && " · "}
                          <a href={so.url} target="_blank" rel="noopener noreferrer">
                            {so.label}
                          </a>
                        </span>
                      ))}
                    </dd>
                  </>
                )}
              </dl>
              {booth.benefits && booth.benefits.length > 0 && (
                <>
                  <div className="jb-req-title">Benefit</div>
                  <ul className="jb-req">
                    {booth.benefits.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </>
              )}
              <div className="jb-req-title">Posisi yang dibuka</div>
              <ul className="jb-req">
                {openJobs(booth).map((j) => (
                  <li key={j.id}>
                    {j.title} · {j.type}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="mb-nav">
          <button type="button" onClick={() => go(-1)} disabled={page === 0} aria-label="Halaman sebelumnya">
            ◀
          </button>
          <span>
            Halaman {page + 1} / {pages.length}
          </span>
          <button type="button" onClick={() => go(1)} disabled={page === pages.length - 1} aria-label="Halaman berikutnya">
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}

export interface ApplicationInput {
  jobId: string;
  name: string;
  email: string;
  phone: string;
  cvUrl: string;
  message: string;
}

/** The application form for one booth. */
export function ApplyForm({
  booth,
  jobId,
  defaultName = "",
  defaults = {},
  appliedJobIds = new Set(),
  cost,
  onSubmit,
  onClose,
}: {
  booth: CompanyBooth;
  jobId?: string;
  /** What sending costs, shown on the button, e.g. "5 🪙" or "voucher". */
  cost?: string;
  defaultName?: string;
  /** Prefill from the visitor's profile. */
  defaults?: Partial<Omit<ApplicationInput, "jobId">>;
  appliedJobIds?: Set<string>;
  onSubmit: (a: ApplicationInput) => void;
  onClose: () => void;
}) {
  const open = openJobs(booth).filter((j) => !appliedJobIds.has(j.id));
  const [form, setForm] = useState<ApplicationInput>({
    jobId: jobId && !appliedJobIds.has(jobId) ? jobId : (open[0]?.id ?? ""),
    name: defaults.name || defaultName,
    email: defaults.email ?? "",
    phone: defaults.phone ?? "",
    cvUrl: defaults.cvUrl ?? "",
    message: defaults.message ?? "",
  });
  const id = useId();
  useEscape(onClose);
  const set = (k: keyof ApplicationInput) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.jobId) onSubmit(form);
  };

  return (
    <div className="mb-backdrop" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
      <form className="rpg-box mb jb-form" aria-label={`Lamar ke ${booth.company}`} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="mb-head">
          <span className="mb-title">📝 Lamar ke {booth.company}</span>
          <button type="button" className="mb-close" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        {open.length === 0 ? (
          <p className="jb-about">Kamu sudah melamar semua posisi di {booth.company}. Semoga berhasil!</p>
        ) : (
          <div className="jb-fields">
            <label htmlFor={`${id}-job`}>Posisi</label>
            <select id={`${id}-job`} value={form.jobId} onChange={set("jobId")}>
              {open.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.type})
                </option>
              ))}
            </select>
            <label htmlFor={`${id}-name`}>Nama lengkap</label>
            <input id={`${id}-name`} required value={form.name} onChange={set("name")} maxLength={60} />
            <label htmlFor={`${id}-email`}>Email</label>
            <input id={`${id}-email`} required type="email" value={form.email} onChange={set("email")} placeholder="nama@email.com" />
            <label htmlFor={`${id}-phone`}>No. HP</label>
            <input id={`${id}-phone`} type="tel" value={form.phone} onChange={set("phone")} placeholder="08xx" />
            <label htmlFor={`${id}-cv`}>Link CV / portofolio</label>
            <input id={`${id}-cv`} type="url" value={form.cvUrl} onChange={set("cvUrl")} placeholder="https://" />
            <label htmlFor={`${id}-msg`}>Pesan singkat</label>
            <textarea id={`${id}-msg`} rows={3} value={form.message} onChange={set("message")} maxLength={500} placeholder="Ceritakan singkat kenapa kamu cocok" />
          </div>
        )}
        <div className="mb-nav">
          <button type="button" onClick={onClose}>
            Batal
          </button>
          {open.length > 0 && (
            <button type="submit" className="jb-submit">
              Kirim lamaran{cost ? ` · ${cost}` : ""}
            </button>
          )}
        </div>
        <p className="mb-note">Ini demo: data lamaran hanya tersimpan di browser ini.</p>
      </form>
    </div>
  );
}
