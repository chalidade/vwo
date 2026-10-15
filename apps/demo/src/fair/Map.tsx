import { type CSSProperties, memo, useEffect, useMemo, useRef, useState } from "react";
import { type CompanyBooth, type Facing, type FloorView, type JobFairView, type ParkBuilding, UMKM_CORNER, safeImage } from "@vwo/shared";
import { Modal } from "./Modal";
import { type FloorPlan, type MapCompany, companiesOn, filterCompanies, floorPlan, hitPad, mapCategories, markSizes, placeChip, planPxPerTile, planScrollFor } from "./map";

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
  const [picked, setPicked] = useState<Picked | null>(null);
  const phone = useNarrow();
  /** On a phone the plan and the list take turns: "Denah" or "Daftar". */
  const [view, setView] = useState<"denah" | "daftar">("denah");
  /** Phone zoom: 1 fits the whole floor across the screen. */
  const [zoom, setZoom] = useState(1);
  const [boxW, setBoxW] = useState(0);
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
    setZoom(1);
  };

  // Phone: how wide the plan's box is, for the pixels a tile (marks never draw smaller than readable).
  const showPlan = phone && (view === "denah" || place.hall < 0);
  useEffect(() => {
    const el = planRef.current;
    if (!showPlan || !el) return;
    setBoxW(el.clientWidth);
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [showPlan]);
  const chipsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chipsRef.current?.querySelector("[data-active]")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [phone, floorId]);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phone && picked && view === "denah") cardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [phone, picked, view]);

  if (phone) {
    const px = planPxPerTile(plan.width, boxW, zoom);
    const card = picked ? companiesOn(fair.booths, place.hall).find((c) => c.booth.id === picked.boothId) : undefined;
    const all = place.hall >= 0 ? companiesOn(fair.booths, place.hall) : [];
    const go = here?.floorId !== place.floorId && !place.closed;
    return (
      <Modal title="🗺️ Peta job fair" onClose={onClose} className="mp mp-phone">
        <div className="mp-chips" ref={chipsRef} role="tablist" aria-label="Pilih lantai">
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
                title={`${p.name} · ${p.label}${p.hall >= 0 ? ` · ${n} ${searching ? "cocok" : "lowongan"}` : ""}${p.closed ? " · segera hadir" : ""}`}
              >
                {p.emoji} {placeChip(p, n)}
                {p.closed && " 🚧"}
                {here?.floorId === p.floorId && <span className="mp-you-dot" aria-label="Kamu di sini" />}
              </button>
            );
          })}
        </div>

        <div className="mp-frow">
          <span className="mp-ftitle">
            <b>
              {place.name} · {place.label}
            </b>
            <span className="sp-muted">
              {place.closed
                ? "🚧 Segera hadir"
                : here?.floorId === place.floorId
                  ? "📍 Kamu di lantai ini"
                  : place.hall >= 0
                    ? `${all.length} perusahaan · ${jobsOn(place)} lowongan`
                    : place.floorId.endsWith("-taman") || place.floorId.endsWith("-perpustakaan")
                      ? "Di luar gedung"
                      : "Tanpa stand perusahaan"}
            </span>
          </span>
          {go && (
            <button type="button" className="mb-order mp-go" onClick={() => onGoPlace(place)}>
              🚶 Pergi ke sini
            </button>
          )}
        </div>

        {place.hall >= 0 && (
          <div className="mp-seg" role="tablist" aria-label="Tampilan">
            <button type="button" role="tab" aria-selected={view === "denah"} data-active={view === "denah" ? "" : undefined} onClick={() => setView("denah")}>
              🗺️ Denah
            </button>
            <button type="button" role="tab" aria-selected={view === "daftar"} data-active={view === "daftar" ? "" : undefined} onClick={() => setView("daftar")}>
              📋 Daftar{searching ? ` · ${companies.length} cocok` : ` · ${all.length}`}
            </button>
          </div>
        )}

        <div className="mp-scroll">
          {showPlan ? (
            <>
              <div className="mp-plan mp-plan-fit" ref={planRef} data-closed={place.closed ? "" : undefined}>
                <PlanSvg
                  plan={plan}
                  place={place}
                  logos={logos}
                  pickedId={picked?.boothId}
                  isDim={(id) => searching && !companies.some((c) => c.booth.id === id)}
                  here={here}
                  px={px || undefined}
                  onPick={(id) => setPicked(picked?.boothId === id ? null : { boothId: id })}
                  style={{ width: `${zoom * 100}%` }}
                />
              </div>
              <div className="mp-zoombar">
                <span className="sp-muted">
                  {plan.booths.length
                    ? here?.floorId === plan.id
                      ? "🟢 kamu · ketuk stand untuk lowongan"
                      : "Ketuk stand untuk melihat lowongannya"
                    : zoom > 1
                      ? "Geser denah ke samping"
                      : ""}
                </span>
                <span className="mp-zoom">
                  <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 1))} disabled={zoom <= 1} aria-label="Perkecil denah">
                    −
                  </button>
                  <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 1))} disabled={zoom >= 3} aria-label="Perbesar denah">
                    +
                  </button>
                </span>
              </div>
              {card && (
                <div className="mp-card" ref={cardRef} style={{ ["--c" as string]: card.booth.color }}>
                  <div className="mp-co">
                    <span className="mp-logo">{logos.get(card.booth.id) ? <img src={logos.get(card.booth.id)} alt="" /> : card.booth.logo}</span>
                    <span className="mp-co-main">
                      <b>{card.booth.company}</b>
                      <span className="sp-muted">{card.booth.industry}</span>
                    </span>
                    <span className="mp-count" data-zero={card.jobs.length ? undefined : ""}>
                      {card.jobs.length} lowongan
                    </span>
                  </div>
                  {card.jobs.length > 0 && (
                    <p className="mp-card-jobs">
                      {card.jobs
                        .slice(0, 3)
                        .map((j) => j.title)
                        .join(" · ")}
                      {card.jobs.length > 3 && ` · +${card.jobs.length - 3} lagi`}
                    </p>
                  )}
                  <div className="mp-acts">
                    <button type="button" className="mb-order" disabled={place.closed} onClick={() => onWalk(card.booth)}>
                      🚶 Jalan ke sini
                    </button>
                    <button type="button" className="mp-see" onClick={() => onOpenJob(card.booth.id)}>
                      {card.jobs.length ? "Lihat lowongan" : "Profil perusahaan"}
                    </button>
                    <button type="button" className="mp-card-x" onClick={() => setPicked(null)} aria-label="Tutup kartu">
                      ✕
                    </button>
                  </div>
                </div>
              )}
              {place.hall >= 0 ? (
                all.length ? (
                  <ul className="mp-stands" aria-label="Perusahaan di lantai ini">
                    {all.map(({ booth: b, jobs, stand }) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          data-active={picked?.boothId === b.id ? "" : undefined}
                          style={{ ["--c" as string]: b.color }}
                          onClick={() => (stand ? setPicked({ boothId: b.id }) : onOpenJob(b.id))}
                        >
                          <span className="mp-logo">{logos.get(b.id) ? <img src={logos.get(b.id)} alt="" /> : b.logo}</span>
                          <span className="mp-stand-name">{b.company}</span>
                          <span className="mp-count" data-zero={jobs.length ? undefined : ""}>
                            {stand ? jobs.length : "UMKM"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sp-muted mp-empty">Belum ada perusahaan di lantai ini.</p>
                )
              ) : (
                <p className="sp-muted mp-empty">{aboutPlace(place, here)}</p>
              )}
            </>
          ) : (
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
                <CompanyList
                  listRef={listRef}
                  companies={companies}
                  logos={logos}
                  picked={picked}
                  searching={searching}
                  closed={place.closed}
                  onPick={setPicked}
                  onWalk={onWalk}
                  onOpenJob={onOpenJob}
                  onShowOnPlan={(id) => {
                    setPicked({ boothId: id });
                    setView("denah");
                  }}
                />
              ) : (
                <p className="sp-muted mp-empty">{searching ? "Tidak ada yang cocok di lantai ini. Coba lantai lain atau kata lain." : "Belum ada perusahaan di lantai ini."}</p>
              )}
            </>
          )}
        </div>
      </Modal>
    );
  }

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
        <PlanSvg
          plan={plan}
          place={place}
          logos={logos}
          pickedId={picked?.boothId}
          isDim={(id) => searching && !companies.some((c) => c.booth.id === id)}
          here={here}
          onPick={(id) => setPicked({ boothId: id })}
          style={{ minWidth: plan.width * (place.hall >= 0 ? MIN_PX.hall : MIN_PX.other) }}
        />
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
            <CompanyList
              listRef={listRef}
              companies={companies}
              logos={logos}
              picked={picked}
              searching={searching}
              closed={place.closed}
              onPick={setPicked}
              onWalk={onWalk}
              onOpenJob={onOpenJob}
            />
          ) : (
            <p className="sp-muted mp-empty">{searching ? "Tidak ada yang cocok di lantai ini. Coba lantai lain atau kata lain." : "Belum ada perusahaan di lantai ini."}</p>
          )}
        </>
      ) : (
        <p className="sp-muted mp-empty">{aboutPlace(place, here)}</p>
      )}
    </Modal>
  );
}

type Picked = { boothId: string; jobId?: string };

/** Phones get their own layout (a full-screen sheet, the plan and the list taking turns). */
function useNarrow(query = "(max-width: 600px)") {
  const [narrow, setNarrow] = useState(() => typeof matchMedia === "function" && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia(query);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return narrow;
}

/** What a floor without stands is, for the line under its plan. */
function aboutPlace(place: MapPlace, here: MapHere | null) {
  if (place.floorId.endsWith("-taman")) return "Taman di luar gedung: lewat pintu lobi. Ada Perpustakaan, telepon umum, dan gedung acara berikutnya.";
  if (place.floorId.endsWith("-perpustakaan")) return "Perpustakaan di taman: baca buku karier dan duduk di meja baca.";
  if (here?.floorId === place.floorId) return "Lantai ini tanpa stand perusahaan. Stand ada di lantai bertanda 💼.";
  return `Lantai ini tanpa stand perusahaan. Naik lift ke ${place.name}, atau pilih lantai 💼 untuk melihat lowongan.`;
}

/** The plan of a floor: the floor, the stands, "Kamu di sini", and the closed overlay. `px` (phones) is
 *  how many pixels a tile is drawn at, to keep the marks readable when the whole floor fits the screen. */
function PlanSvg({
  plan,
  place,
  logos,
  pickedId,
  isDim,
  here,
  px,
  onPick,
  style,
}: {
  plan: FloorPlan;
  place: MapPlace;
  logos: Map<string, string | undefined>;
  pickedId?: string;
  isDim: (boothId: string) => boolean;
  here: MapHere | null;
  px?: number;
  onPick: (boothId: string) => void;
  style: CSSProperties;
}) {
  const sizes = useMemo(() => markSizes(px), [px]);
  return (
    <svg
      viewBox={`-0.5 -0.5 ${plan.width + 1} ${plan.height + 1}`}
      style={style}
      role="img"
      aria-label={`Denah ${place.name} · ${place.label}`}
      className={place.floorId.endsWith("-taman") ? "mp-svg mp-park" : "mp-svg"}
    >
      <PlanBase plan={plan} labelMin={sizes.labelMin} compact={!!px} />
      {plan.booths.map((b) => (
        <BoothMark key={b.id} b={b} logo={logos.get(b.id)} active={b.id === pickedId} dim={isDim(b.id)} sizes={sizes} px={px} onPick={() => onPick(b.id)} />
      ))}
      {here?.floorId === plan.id && <YouMark x={here.x} y={here.y} facing={here.facing} scale={sizes.you} label={!sizes.compact} />}
      {place.closed && (
        <g className="mp-closed">
          <rect x={0} y={0} width={plan.width} height={plan.height} />
          <text x={plan.width / 2} y={plan.height / 2} fontSize={Math.max(2, sizes.labelMin * 2)}>
            🚧 Segera hadir
          </text>
        </g>
      )}
    </svg>
  );
}

/** The companies of a floor and their vacancies; picking one offers the walk there and its job board. */
function CompanyList({
  listRef,
  companies,
  logos,
  picked,
  searching,
  closed,
  onPick,
  onWalk,
  onOpenJob,
  onShowOnPlan,
}: {
  listRef: React.RefObject<HTMLUListElement | null>;
  companies: MapCompany[];
  logos: Map<string, string | undefined>;
  picked: Picked | null;
  searching: boolean;
  closed: boolean;
  onPick: (p: Picked | null) => void;
  onWalk: (b: CompanyBooth) => void;
  onOpenJob: (boothId: string, jobId?: string) => void;
  /** Phones: show the stand on the plan. */
  onShowOnPlan?: (boothId: string) => void;
}) {
  return (
    <ul className="mp-list" ref={listRef}>
      {companies.map(({ booth: b, jobs, stand }) => {
        const active = picked?.boothId === b.id;
        return (
          <li key={b.id} data-booth={b.id} data-active={active ? "" : undefined} style={{ ["--c" as string]: b.color }}>
            <button type="button" className="mp-co" onClick={() => onPick(active ? null : { boothId: b.id })} aria-expanded={active}>
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
                    <button type="button" data-active={active && picked?.jobId === j.id ? "" : undefined} onClick={() => onPick({ boothId: b.id, jobId: j.id })}>
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
                  <button type="button" className="mb-order" disabled={closed} onClick={() => onWalk(b)}>
                    🚶 Jalan ke sini
                  </button>
                ) : (
                  <span className="sp-muted">Tanpa stand: lowongannya dilihat dari sini.</span>
                )}
                <button type="button" className="mp-see" onClick={() => onOpenJob(b.id, picked?.jobId)}>
                  {picked?.jobId ? "Lihat lowongan ini" : jobs.length ? "Lihat lowongan" : "Profil perusahaan"}
                </button>
                {stand && onShowOnPlan && (
                  <button type="button" className="mp-see" onClick={() => onShowOnPlan(b.id)}>
                    📍 Denah
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The floor itself: walls, furniture and labelled places. Drawn once per plan. */
const PlanBase = memo(function PlanBase({ plan, labelMin = 0, compact = false }: { plan: FloorPlan; labelMin?: number; compact?: boolean }) {
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
        const size = Math.max(labelMin, Math.min(0.85, Math.max(0.55, s.h * 0.45)));
        // Cut a long name to what fits across its shape; on a phone a label with no room is left out.
        const room = Math.floor(s.w / (size * 0.58));
        if (compact && room < Math.min(6, s.label.length)) return null;
        const fit = Math.max(3, room);
        return (
          <text key={`t${i}`} className={`mp-label mp-label-${s.kind}`} data-out={compact && s.h < size * 1.2 ? "" : undefined} x={s.x + s.w / 2} y={s.y + s.h / 2} fontSize={size}>
            {s.label.length > fit ? `${s.label.slice(0, fit - 1)}…` : s.label}
          </text>
        );
      })}
    </g>
  );
});

/** A company stand: its colour, logo, a short name and how many vacancies it has open. */
const BoothMark = memo(function BoothMark({
  b,
  logo,
  active,
  dim,
  sizes,
  px,
  onPick,
}: {
  b: FloorPlan["booths"][number];
  logo?: string;
  active: boolean;
  dim: boolean;
  sizes: ReturnType<typeof markSizes>;
  px?: number;
  onPick: () => void;
}) {
  const cx = b.x + b.w / 2;
  const { logoR: r, logoFont, badgeFont: bf, nameFont, compact } = sizes;
  const cy = b.y + 1.15;
  const pad = hitPad(px, b.w, b.h);
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
      {(pad.dx > 0 || pad.dy > 0) && <rect className="mp-booth-hit" x={b.x - pad.dx} y={b.y - pad.dy} width={b.w + 2 * pad.dx} height={b.h + 2 * pad.dy} />}
      <title>{`${b.company} · ${b.jobs} lowongan`}</title>
      {compact ? (
        // Too small for a logo, a name and a badge: a block in the company's colour with its initials.
        <>
          <rect className="mp-booth-box" data-solid="" x={b.x} y={b.y} width={b.w} height={b.h} rx={0.35} />
          <text className="mp-booth-logo-t" x={cx} y={b.y + b.h / 2} fontSize={Math.min(b.h * 0.6, b.w / (Math.max(2, b.logo.slice(0, 3).length) * 0.72))}>
            {b.logo.slice(0, 3)}
          </text>
        </>
      ) : (
        <>
          <rect className="mp-booth-box" x={b.x} y={b.y} width={b.w} height={b.h} rx={0.35} />
          {logo ? (
            <>
              <clipPath id={clip}>
                <circle cx={cx} cy={cy} r={r} />
              </clipPath>
              <image href={logo} x={cx - r} y={cy - r} width={2 * r} height={2 * r} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
            </>
          ) : (
            <>
              <circle className="mp-booth-logo" cx={cx} cy={cy} r={r} />
              <text className="mp-booth-logo-t" x={cx} y={cy + 0.02} fontSize={logoFont}>
                {b.logo.slice(0, 3)}
              </text>
            </>
          )}
          <text className="mp-booth-name" x={cx} y={b.y + 2.6} fontSize={nameFont}>
            {name}
          </text>
          <g className="mp-badge" data-zero={b.jobs ? undefined : ""}>
            <rect x={b.x + b.w - 1.3} y={b.y - 0.4} width={1.6} height={1.1} rx={0.55} />
            <text x={b.x + b.w - 0.5} y={b.y + 0.17} fontSize={bf}>
              {b.jobs}
            </text>
          </g>
          {b.vip && (
            <text x={b.x + 0.7} y={b.y + 0.6} fontSize={0.7}>
              👑
            </text>
          )}
        </>
      )}
    </g>
  );
});

const ARROW: Record<Facing, number> = { back: 0, right: 90, front: 180, left: 270 };

/** "Kamu di sini": the player as an arrow pointing the way they face, with a pulsing ring. */
function YouMark({ x, y, facing, scale = 1, label = true }: { x: number; y: number; facing: Facing; scale?: number; label?: boolean }) {
  return (
    <g className="mp-you" transform={`translate(${x} ${y})${scale !== 1 ? ` scale(${scale})` : ""}`}>
      <circle className="mp-you-ring" r={1.2} />
      <circle className="mp-you-dot-svg" r={0.62} />
      <path d="M0 -0.45 L0.32 0.3 L0 0.15 L-0.32 0.3 Z" transform={`rotate(${ARROW[facing]})`} />
      {label && (
        <text y={-1.5} fontSize={0.8}>
          Kamu di sini
        </text>
      )}
    </g>
  );
}
