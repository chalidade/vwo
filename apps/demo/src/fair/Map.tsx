import { memo, useEffect, useMemo, useRef, useState } from "react";
import { type CompanyBooth, type Facing, type FloorView, type JobFairView, type ParkBuilding, UMKM_CORNER, safeImage } from "@vwo/shared";
import { Modal } from "./Modal";
import { type FloorPlan, companiesOn, filterCompanies, floorPlan, mapCategories, planScrollFor } from "./map";

/** One tab of the map: a lift stop, the park or the Perpustakaan. */
export interface MapPlace {
  floorId: string;
  name: string;
  label: string;
  emoji: string;
  /** The hall index for a floor with booths, else -1. */
  hall: number;
  /** Closed by the organiser for now ("Segera hadir"). */
  closed: boolean;
}

/** Where the job seeker stands now. */
export interface MapHere {
  floorId: string;
  x: number;
  y: number;
  facing: Facing;
}

/** Pixels per tile the plan is drawn at, at least: a wide floor scrolls sideways on a phone instead of
 *  shrinking past reading. Halls are twice as wide as the rooms, so they get a little less. */
const MIN_PX = { hall: 8, other: 10 };

/** The job seeker's map: a plan of every floor with the company stands and their open vacancies, a
 *  list to search, and a way to walk to any stand. Everything comes from the fair already loaded. */
export function MapPanel({
  fair,
  floorOf,
  places,
  parkBuildings,
  here,
  onWalk,
  onOpenJob,
  onGoPlace,
  onClose,
}: {
  fair: JobFairView;
  floorOf: (floorId: string) => FloorView;
  places: MapPlace[];
  parkBuildings: ParkBuilding[];
  here: MapHere | null;
  onWalk: (b: CompanyBooth) => void;
  onOpenJob: (boothId: string, jobId?: string) => void;
  onGoPlace: (place: MapPlace) => void;
  onClose: () => void;
}) {
  const [floorId, setFloorId] = useState(() => (places.some((p) => p.floorId === here?.floorId) ? here!.floorId : (places[0]?.floorId ?? "")));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [picked, setPicked] = useState<{ boothId: string; jobId?: string } | null>(null);
  const place = places.find((p) => p.floorId === floorId) ?? places[0]!;

  // The plan only changes when a stand moves, opens or closes a vacancy, or the park changes: a short
  // key of exactly that keeps it from being rebuilt on every frame the game redraws.
  const standKey = fair.booths
    .filter((b) => b.floor === place.hall)
    .map((b) => `${b.id}:${b.x}:${b.y}:${b.tier ?? ""}:${b.jobs.filter((j) => !j.closed).length}:${b.color}:${b.logo}`)
    .join("|");
  const parkKey = parkBuildings.map((b) => `${b.id}:${b.name}:${b.status}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plan = useMemo(() => floorPlan(fair, floorOf(place.floorId), parkBuildings), [place.floorId, standKey, parkKey]);
  const logos = useMemo(() => new Map(fair.booths.map((b) => [b.id, safeImage(b.logoImg)])), [fair.booths]);

  const categories = useMemo(() => mapCategories(fair.booths), [fair.booths]);
  const companies = filterCompanies(place.hall >= 0 ? companiesOn(fair.booths, place.hall) : [], query, category);
  const searching = !!query.trim() || !!category;
  /** While searching, each floor tab says how many companies there match. */
  const matches = (p: MapPlace) => (p.hall < 0 ? 0 : filterCompanies(companiesOn(fair.booths, p.hall), query, category).length);
  const jobsOn = (p: MapPlace) => (p.hall < 0 ? 0 : companiesOn(fair.booths, p.hall).reduce((n, c) => n + c.jobs.length, 0));

  const planRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Bring the picked stand, or else the player, into view on a plan wider than the screen.
  const focus = plan.booths.find((b) => b.id === picked?.boothId);
  // A room or the park with neither opens on its middle (the park's main building and fountain).
  const focusX = focus ? focus.x + focus.w / 2 : here?.floorId === plan.id ? here.x : place.hall < 0 ? plan.width / 2 : null;
  useEffect(() => {
    const el = planRef.current;
    if (el && focusX != null && el.scrollWidth > el.clientWidth) el.scrollTo({ left: planScrollFor(plan, focusX, el.scrollWidth, el.clientWidth), behavior: "smooth" });
  }, [plan, focusX]);
  useEffect(() => {
    if (picked) listRef.current?.querySelector(`[data-booth="${CSS.escape(picked.boothId)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [picked]);

  const pickFloor = (id: string) => {
    setFloorId(id);
    setPicked(null);
  };

  return (
    <Modal title="🗺️ Peta job fair" onClose={onClose} className="mp">
      <div className="mp-floors" role="tablist" aria-label="Pilih lantai">
        {places.map((p) => {
          const n = searching ? matches(p) : jobsOn(p);
          return (
            <button
              key={p.floorId}
              type="button"
              role="tab"
              aria-selected={p.floorId === place.floorId}
              data-active={p.floorId === place.floorId ? "" : undefined}
              data-closed={p.closed ? "" : undefined}
              data-dim={searching && p.hall >= 0 && !n ? "" : undefined}
              onClick={() => pickFloor(p.floorId)}
              title={p.closed ? `${p.name} · ${p.label}: segera hadir` : `${p.name} · ${p.label}`}
            >
              <span className="mp-floor-name">
                {p.emoji} {p.name}
                {here?.floorId === p.floorId && <span className="mp-you-dot" aria-label="Kamu di sini" />}
              </span>
              <span className="mp-floor-sub">{p.closed ? "🚧 Segera hadir" : p.hall >= 0 ? (searching ? `${n} cocok` : `${n} lowongan`) : p.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mp-head">
        <span>
          <b>
            {place.emoji} {place.name} · {place.label}
          </b>
          {here?.floorId === place.floorId ? <span className="mp-here-tag">📍 Kamu di sini</span> : null}
          {place.closed && <span className="mp-closed-tag">🚧 Segera hadir</span>}
        </span>
        {here?.floorId !== place.floorId && !place.closed && (
          <button type="button" className="mb-order" onClick={() => onGoPlace(place)}>
            🚶 Pergi ke sini
          </button>
        )}
      </div>

      <div className="mp-plan" ref={planRef} data-closed={place.closed ? "" : undefined} data-hall={place.hall >= 0 ? "" : undefined}>
        <svg
          viewBox={`-0.5 -0.5 ${plan.width + 1} ${plan.height + 1}`}
          style={{ minWidth: plan.width * (place.hall >= 0 ? MIN_PX.hall : MIN_PX.other) }}
          role="img"
          aria-label={`Denah ${place.name} · ${place.label}`}
          className={place.floorId.endsWith("-taman") ? "mp-svg mp-park" : "mp-svg"}
        >
          <PlanBase plan={plan} />
          {plan.booths.map((b) => (
            <BoothMark
              key={b.id}
              b={b}
              logo={logos.get(b.id)}
              active={b.id === picked?.boothId}
              dim={searching && !companies.some((c) => c.booth.id === b.id)}
              onPick={() => setPicked({ boothId: b.id })}
            />
          ))}
          {here?.floorId === plan.id && <YouMark x={here.x} y={here.y} facing={here.facing} />}
          {place.closed && (
            <g className="mp-closed">
              <rect x={0} y={0} width={plan.width} height={plan.height} />
              <text x={plan.width / 2} y={plan.height / 2} fontSize={2}>
                🚧 Segera hadir
              </text>
            </g>
          )}
        </svg>
      </div>

      {place.hall >= 0 ? (
        <>
          <div className="mp-tools">
            <input
              type="search"
              value={query}
              maxLength={60}
              placeholder="Cari perusahaan atau posisi…"
              aria-label="Cari perusahaan atau posisi"
              onChange={(e) => setQuery(e.target.value)}
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Kategori">
              <option value="">Semua kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {companies.length ? (
            <ul className="mp-list" ref={listRef}>
              {companies.map(({ booth: b, jobs, stand }) => {
                const active = picked?.boothId === b.id;
                return (
                  <li key={b.id} data-booth={b.id} data-active={active ? "" : undefined} style={{ ["--c" as string]: b.color }}>
                    <button type="button" className="mp-co" onClick={() => setPicked(active ? null : { boothId: b.id })} aria-expanded={active}>
                      <span className="mp-logo">{logos.get(b.id) ? <img src={logos.get(b.id)} alt="" /> : b.logo}</span>
                      <span className="mp-co-main">
                        <b>{b.company}</b>
                        <span className="sp-muted">
                          {b.industry}
                          {!stand && ` · ${UMKM_CORNER}`}
                        </span>
                      </span>
                      <span className="mp-count" data-zero={b.jobs.some((j) => !j.closed) ? undefined : ""}>
                        {searching && jobs.length !== b.jobs.filter((j) => !j.closed).length ? `${jobs.length} cocok` : `${jobs.length} lowongan`}
                      </span>
                    </button>
                    {jobs.length > 0 && (
                      <ul className="mp-jobs">
                        {jobs.map((j) => (
                          <li key={j.id}>
                            <button type="button" data-active={active && picked?.jobId === j.id ? "" : undefined} onClick={() => setPicked({ boothId: b.id, jobId: j.id })}>
                              <span>{j.title}</span>
                              <span className="mp-type">{j.type}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {active && (
                      <div className="mp-acts">
                        {stand ? (
                          <button type="button" className="mb-order" disabled={place.closed} onClick={() => onWalk(b)}>
                            🚶 Jalan ke sini
                          </button>
                        ) : (
                          <span className="sp-muted">Tanpa stand: lowongannya dilihat dari sini.</span>
                        )}
                        <button type="button" className="mp-see" onClick={() => onOpenJob(b.id, picked?.jobId)}>
                          {picked?.jobId ? "Lihat lowongan ini" : jobs.length ? "Lihat lowongan" : "Profil perusahaan"}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="sp-muted mp-empty">{searching ? "Tidak ada yang cocok di lantai ini. Coba lantai lain atau kata lain." : "Belum ada perusahaan di lantai ini."}</p>
          )}
        </>
      ) : (
        <p className="sp-muted mp-empty">
          {place.floorId.endsWith("-taman")
            ? "Taman di luar gedung: lewat pintu lobi. Ada Perpustakaan, telepon umum, dan gedung acara berikutnya."
            : place.floorId.endsWith("-perpustakaan")
              ? "Perpustakaan di taman: baca buku karier dan duduk di meja baca."
              : here?.floorId === place.floorId
                ? "Lantai ini tanpa stand perusahaan. Stand ada di lantai bertanda 💼."
                : `Lantai ini tanpa stand perusahaan. Naik lift ke ${place.name}, atau pilih lantai 💼 untuk melihat lowongan.`}
        </p>
      )}
    </Modal>
  );
}

/** The floor itself: walls, furniture and labelled places. Drawn once per plan. */
const PlanBase = memo(function PlanBase({ plan }: { plan: FloorPlan }) {
  return (
    <g>
      <rect className="mp-floor" x={0} y={0} width={plan.width} height={plan.height} rx={0.4} />
      {plan.shapes.map((s, i) => (
        <rect
          key={i}
          className={`mp-k mp-k-${s.kind}`}
          x={s.x}
          y={s.y}
          width={Math.max(0.2, s.w)}
          height={Math.max(0.2, s.h)}
          rx={s.kind === "water" ? Math.min(s.w, s.h) / 2 : 0.2}
          style={s.color ? { fill: s.color } : undefined}
        />
      ))}
      {plan.shapes.map((s, i) => {
        if (!s.label) return null;
        const size = Math.min(0.85, Math.max(0.55, s.h * 0.45));
        // Cut a long name to what fits across its shape.
        const fit = Math.max(3, Math.floor(s.w / (size * 0.58)));
        return (
          <text key={`t${i}`} className={`mp-label mp-label-${s.kind}`} x={s.x + s.w / 2} y={s.y + s.h / 2} fontSize={size}>
            {s.label.length > fit ? `${s.label.slice(0, fit - 1)}…` : s.label}
          </text>
        );
      })}
    </g>
  );
});

/** A company stand: its colour, logo, a short name and how many vacancies it has open. */
const BoothMark = memo(function BoothMark({ b, logo, active, dim, onPick }: { b: FloorPlan["booths"][number]; logo?: string; active: boolean; dim: boolean; onPick: () => void }) {
  const cx = b.x + b.w / 2;
  const name = b.company.length > 14 ? `${b.company.slice(0, 13)}…` : b.company;
  const clip = `mp-clip-${b.id}`;
  return (
    <g
      className="mp-booth"
      data-active={active ? "" : undefined}
      data-dim={dim ? "" : undefined}
      role="button"
      tabIndex={0}
      aria-label={`${b.company}, ${b.jobs} lowongan`}
      onClick={onPick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick())}
      style={{ ["--c" as string]: b.color }}
    >
      <rect className="mp-booth-box" x={b.x} y={b.y} width={b.w} height={b.h} rx={0.35} />
      {logo ? (
        <>
          <clipPath id={clip}>
            <circle cx={cx} cy={b.y + 1.15} r={0.8} />
          </clipPath>
          <image href={logo} x={cx - 0.8} y={b.y + 0.35} width={1.6} height={1.6} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
        </>
      ) : (
        <>
          <circle className="mp-booth-logo" cx={cx} cy={b.y + 1.15} r={0.8} />
          <text className="mp-booth-logo-t" x={cx} y={b.y + 1.17} fontSize={0.72}>
            {b.logo.slice(0, 3)}
          </text>
        </>
      )}
      <title>{`${b.company} · ${b.jobs} lowongan`}</title>
      <text className="mp-booth-name" x={cx} y={b.y + 2.6} fontSize={0.88}>
        {name}
      </text>
      <g className="mp-badge" data-zero={b.jobs ? undefined : ""}>
        <rect x={b.x + b.w - 1.3} y={b.y - 0.4} width={1.6} height={1.1} rx={0.55} />
        <text x={b.x + b.w - 0.5} y={b.y + 0.17} fontSize={0.75}>
          {b.jobs}
        </text>
      </g>
      {b.vip && (
        <text x={b.x + 0.7} y={b.y + 0.6} fontSize={0.7}>
          👑
        </text>
      )}
    </g>
  );
});

const ARROW: Record<Facing, number> = { back: 0, right: 90, front: 180, left: 270 };

/** "Kamu di sini": the player as an arrow pointing the way they face, with a pulsing ring. */
function YouMark({ x, y, facing }: { x: number; y: number; facing: Facing }) {
  return (
    <g className="mp-you" transform={`translate(${x} ${y})`}>
      <circle className="mp-you-ring" r={1.2} />
      <circle className="mp-you-dot-svg" r={0.62} />
      <path d="M0 -0.45 L0.32 0.3 L0 0.15 L-0.32 0.3 Z" transform={`rotate(${ARROW[facing]})`} />
      <text y={-1.5} fontSize={0.8}>
        Kamu di sini
      </text>
    </g>
  );
}
