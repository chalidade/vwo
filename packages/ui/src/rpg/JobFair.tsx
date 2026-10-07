"use client";
// The job fair room: the hall's back wall, company booths (back panel, desk, roll-up banner),
// the organisers' info desk, and the popups for reading vacancies and applying.
import { type CSSProperties, type FormEvent, useEffect, useId, useState } from "react";
import { BOOTH_H, BOOTH_W, type CompanyBooth, type JobPosting, SPONSOR_H, SPONSOR_W, type SponsorView } from "@vwo/shared";
import type { SceneExtra } from "./CafeScene";
import { INK } from "./Furniture";

const ink = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const T = 48;

/** The back wall of an exhibition hall: panels, the event banner, bunting and spotlights. */
export function HallWall({ w, h, title, sponsors = [] }: { w: number; h: number; title: string; sponsors?: SponsorView[] }) {
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
        <g transform={`translate(${(w - bw) / 2}, 32)`}>
          <rect x={0} y={0} width={bw} height={72} rx={8} fill="#1e3a8a" {...ink} />
          <rect x={6} y={6} width={bw - 12} height={60} rx={5} fill="none" stroke="#fbbf24" strokeWidth={2} strokeDasharray="6 4" />
          <text x={bw / 2} y={36} textAnchor="middle" fontSize={26} fontWeight={900} fill="#fff" fontFamily="system-ui, sans-serif" letterSpacing={1}>
            {title.toUpperCase()}
          </text>
          <text x={bw / 2} y={56} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fde68a" fontFamily="system-ui, sans-serif">
            Temukan karier impianmu · Gratis untuk semua pencari kerja
          </text>
        </g>
      </svg>
      {sponsors.length > 0 && (
        <>
          <SponsorStrip sponsors={sponsors.slice(0, Math.ceil(sponsors.length / 2))} style={{ right: (w + bw) / 2 + 16, top: 40 }} />
          <SponsorStrip sponsors={sponsors.slice(Math.ceil(sponsors.length / 2))} style={{ left: (w + bw) / 2 + 16, top: 40 }} />
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

function BoothPanel({ booth }: { booth: CompanyBooth }) {
  const w = BOOTH_W * T;
  const h = 2.2 * T;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      {/* Side posts. */}
      <rect x={0} y={4} width={8} height={h - 4} fill="#cbd5e1" {...ink} strokeWidth={1.6} />
      <rect x={w - 8} y={4} width={8} height={h - 4} fill="#cbd5e1" {...ink} strokeWidth={1.6} />
      {/* The wall itself. */}
      <rect x={6} y={10} width={w - 12} height={h - 12} fill="#f8fafc" {...ink} strokeWidth={1.8} />
      <rect x={6} y={h - 26} width={w - 12} height={24} fill="#e2e8f0" />
      {/* Fascia with the company name. */}
      <rect x={-4} y={0} width={w + 8} height={34} rx={4} fill={booth.color} {...ink} />
      <g transform="translate(24, 17)">
        <Logo booth={booth} r={13} />
      </g>
      <text x={44} y={23} fontSize={16} fontWeight={900} fill="#fff" fontFamily="system-ui, sans-serif">
        {booth.company}
      </text>
      <text x={w - 12} y={22} textAnchor="end" fontSize={10} fontWeight={700} fill="#fff" opacity={0.85} fontFamily="system-ui, sans-serif">
        {booth.industry}
      </text>
      {/* Posters. */}
      <g transform={`translate(18, 42)`}>
        <rect width={104} height={50} rx={4} fill="#fff" {...ink} strokeWidth={1.4} />
        <rect width={104} height={12} rx={3} fill={booth.color} opacity={0.85} />
        <foreignObject x={4} y={13} width={96} height={36}>
          <div className="jb-poster">{booth.tagline}</div>
        </foreignObject>
      </g>
      <g transform={`translate(134, 42)`}>
        <rect width={96} height={50} rx={4} fill="#fef3c7" {...ink} strokeWidth={1.4} />
        <text x={48} y={22} textAnchor="middle" fontSize={13} fontWeight={900} fill={INK} fontFamily="system-ui, sans-serif">
          KAMI
        </text>
        <text x={48} y={39} textAnchor="middle" fontSize={13} fontWeight={900} fill={booth.color} fontFamily="system-ui, sans-serif">
          MEREKRUT!
        </text>
      </g>
      {/* A small screen. */}
      <g transform={`translate(${w - 50}, 46)`}>
        <rect width={34} height={24} rx={3} fill="#1f2937" {...ink} strokeWidth={1.4} />
        <rect x={3} y={3} width={28} height={18} rx={2} fill={booth.color} opacity={0.7} />
        <path d="M13 8l8 4-8 4Z" fill="#fff" />
        <rect x={15} y={24} width={4} height={10} fill="#64748b" />
      </g>
    </svg>
  );
}

function BoothDesk({ booth }: { booth: CompanyBooth }) {
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
}

function RollUp({ booth }: { booth: CompanyBooth }) {
  const w = 50;
  const h = 2.5 * T;
  return (
    <div className="jb-rollup" style={{ width: w, height: h, ["--c" as string]: booth.color }}>
      <div className="jb-rollup-head">LOWONGAN</div>
      {booth.jobs.slice(0, 3).map((j) => (
        <div key={j.id} className="jb-rollup-job">
          {j.title}
        </div>
      ))}
      <div className="jb-rollup-foot">{booth.logo}</div>
    </div>
  );
}

/** Everything that draws one booth, in scene coordinates. */
export function boothExtras(
  booth: CompanyBooth,
  opts: { onBanner?: () => void; onDesk?: () => void; visitors?: number } = {},
): SceneExtra[] {
  const { x, y } = booth;
  return [
    {
      key: `${booth.id}-carpet`,
      x: x + 0.1,
      y: y + 0.5,
      z: 0,
      ground: true,
      node: <div className="jb-carpet" style={{ width: (BOOTH_W - 0.2) * T, height: (BOOTH_H - 0.5) * T, ["--c" as string]: booth.color }} />,
    },
    { key: `${booth.id}-panel`, x, y: y - 1.7, z: y + 0.5, node: <BoothPanel booth={booth} /> },
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
      </div>
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
  const pages: BoardPage[] = [
    ...(booth.bannerImages ?? []).map((b) => ({ kind: "image" as const, ...b })),
    ...booth.jobs.map((job) => ({ kind: "job" as const, job })),
    { kind: "about" },
  ];
  const [page, setPage] = useState(() => (startAbout ? pages.length - 1 : Math.max(0, pages.findIndex((p) => p.kind === "job" && p.job.id === startJobId))));
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
                {booth.jobs.map((j) => (
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
  onSubmit,
  onClose,
}: {
  booth: CompanyBooth;
  jobId?: string;
  defaultName?: string;
  /** Prefill from the visitor's profile. */
  defaults?: Partial<Omit<ApplicationInput, "jobId">>;
  appliedJobIds?: Set<string>;
  onSubmit: (a: ApplicationInput) => void;
  onClose: () => void;
}) {
  const open = booth.jobs.filter((j) => !appliedJobIds.has(j.id));
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
              Kirim lamaran
            </button>
          )}
        </div>
        <p className="mb-note">Ini demo: data lamaran hanya tersimpan di browser ini.</p>
      </form>
    </div>
  );
}
