// The job seeker's map (Peta): a simplified top-down plan of every floor, drawn from the same layout
// the game walks on, and the companies on each floor with their open vacancies. Pure helpers only:
// no network, nothing sent anywhere; the panel (Map.tsx) draws what these return.
import {
  AULA,
  BOOTH_H,
  COIN_STAND_H,
  COIN_STAND_W,
  type CompanyBooth,
  type FairRoom,
  type FloorView,
  type JobFairView,
  type JobPosting,
  LIBRARY_ROOM,
  LOUNGE,
  PARK,
  type ParkBuilding,
  SPONSOR_H,
  SPONSOR_W,
  boothFrame,
  fairFloorIndex,
  fairRoomFloorId,
  hasStand,
  infoDeskOn,
  isLibraryFloor,
  isParkFloor,
  openJobs,
  parkPlots,
  stallRect,
  stallSlot,
} from "@vwo/shared";

/** What a shape on the plan is, which picks its colour. */
export type PlanKind =
  | "block"
  | "rug"
  | "decor"
  | "table"
  | "lift"
  | "door"
  | "desk"
  | "stage"
  | "stall"
  | "building"
  | "soon"
  | "water"
  | "path"
  | "shelf"
  | "coins"
  | "sponsor"
  | "seat";

export interface PlanShape {
  kind: PlanKind;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  color?: string;
}

/** A company stand on the plan: its full footprint (VIP wings too) and how many vacancies it has open. */
export interface PlanBooth {
  id: string;
  company: string;
  logo: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  jobs: number;
  vip: boolean;
}

export interface FloorPlan {
  id: string;
  width: number;
  height: number;
  shapes: PlanShape[];
  booths: PlanBooth[];
}

type Box = { x: number; y: number; width: number; height: number };

const box = (kind: PlanKind, b: Box, label?: string, color?: string): PlanShape => ({ kind, x: b.x, y: b.y, w: b.width, h: b.height, label, color });

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The plan of one floor: the walls of its objects as the game blocks them, then the places people
 *  look for (lift, info desk, stage, stalls, buildings...) labelled on top, and the company stands. */
export function floorPlan(fair: JobFairView, floor: FloorView, parkBuildings: ParkBuilding[] = []): FloorPlan {
  const park = isParkFloor(floor.id);
  const library = isLibraryFloor(floor.id);
  const room = fair.rooms.find((r) => fairRoomFloorId(fair, r.id) === floor.id);
  const hall = park || library || room ? -1 : fairFloorIndex(floor.id);
  const stands = hall < 0 ? [] : fair.booths.filter((b) => b.floor === hall && hasStand(b));
  const footprints: Box[] = stands.map((b) => ({ ...boothFrame(b), y: b.y, height: BOOTH_H }));

  const shapes: PlanShape[] = [];
  // The park's walkways go under everything else.
  if (park) shapes.push(...PARK.paths.map((p) => box("path", p)), box("path", PARK.plaza));
  for (const o of floor.objects ?? []) {
    // A stand's own walls and desk are drawn as the stand itself.
    if (footprints.some((f) => overlaps(f, o))) continue;
    if (o.type === "elevator") shapes.push(box("lift", o, "Lift"));
    else if (o.type === "door") shapes.push(box("door", o, o.targetFloorId && isParkFloor(o.targetFloorId) ? "Ke taman" : "Pintu"));
    else if (o.type === "decor") shapes.push(box(o.isWalkable ? "rug" : "decor", o, o.isWalkable && o.width >= 6 && o.spriteKey?.startsWith("rug") ? "Lounge" : undefined));
    else if (o.type !== "spawn_point") shapes.push(box("block", o));
  }
  for (const t of floor.tables) shapes.push(box("table", t));
  // Chairs (not sofa places, which the sofas already show): rows in the Aula, desks in the seminar...
  for (const st of floor.seats) if (!st.sofa) shapes.push({ kind: "seat", x: st.x - 0.25, y: st.y - 0.25, w: 0.5, h: 0.5 });

  if (park) {
    shapes.push(box("building", PARK.main, "Gedung job fair"), box("building", PARK.library, "Perpustakaan"), box("water", PARK.fountain, "Air mancur"));
    shapes.push(box("desk", PARK.phoneBox, "Telepon"));
    for (const { plot, building } of parkPlots(parkBuildings)) if (building) shapes.push(box("soon", plot, building.name));
  } else if (library) {
    const L = LIBRARY_ROOM;
    for (const s of [...L.backShelves, ...L.sideShelves]) shapes.push(box("shelf", s));
    shapes.push(box("desk", L.desk, "Pustakawan"));
  } else {
    const desk = infoDeskOn(fair, floor.id);
    shapes.push(box("desk", desk, "Info"));
    if (room) shapes.push(...roomPlaces(room));
    else {
      if (fair.coinStand.floor === hall) shapes.push(box("coins", { x: fair.coinStand.x, y: fair.coinStand.y, width: COIN_STAND_W, height: COIN_STAND_H }, "Koin"));
      for (const sp of fair.sponsors) if (sp.floor === hall) shapes.push(box("sponsor", { x: sp.x, y: sp.y, width: SPONSOR_W, height: SPONSOR_H }, undefined, sp.color));
    }
  }

  const booths: PlanBooth[] = stands.map((b, i) => {
    const f = footprints[i]!;
    return { id: b.id, company: b.company, logo: b.logo, color: b.color, x: f.x, y: f.y, w: f.width, h: f.height, jobs: openJobs(b).length, vip: b.tier === "premium" };
  });
  return { id: floor.id, width: floor.width, height: floor.height, shapes, booths };
}

/** The labelled places of a room floor: the stage, the stalls, the consultants' desks. */
function roomPlaces(room: FairRoom): PlanShape[] {
  if (room.kind === "aula") return [box("stage", AULA.stage, "Panggung"), box("rug", AULA.meet, "Meeting point")];
  if (room.kind === "seminar") return [box("stage", { x: 4, y: 0.3, width: room.width - 8, height: 2.6 }, "Panggung seminar")];
  if (room.kind === "psikotes") return [box("desk", { x: room.width / 2 - 2, y: 1.2, width: 4, height: 0.8 }, "Pengawas")];
  if (room.kind === "konsultasi")
    return [
      ...LOUNGE.pods.map((x, i) => box("stall", { x, y: 0.3, width: LOUNGE.podW, height: 2.3 }, room.consultants?.[i]?.name ?? "Konsultan", room.color)),
      box("desk", LOUNGE.board, "Harga"),
    ];
  return (room.stalls ?? []).map((st, i) => box("stall", stallRect(stallSlot(st, i)), st.name, st.color));
}

/** A company on the map's list, with the vacancies it has open now (the booth board's list). */
export interface MapCompany {
  booth: CompanyBooth;
  jobs: JobPosting[];
  /** False for a mini (UMKM) booth: listed in the Pojok UMKM, no stand on the floor. */
  stand: boolean;
}

/** Every company on hall `hall`, stands first (back row, left to right), then the UMKM corner. Companies
 *  with nothing open are listed too, with no vacancies. */
export function companiesOn(booths: CompanyBooth[], hall: number): MapCompany[] {
  return booths
    .filter((b) => b.floor === hall)
    .map((b) => ({ booth: b, jobs: openJobs(b), stand: hasStand(b) }))
    .sort((a, b) => Number(b.stand) - Number(a.stand) || (a.stand ? a.booth.y - b.booth.y || a.booth.x - b.booth.x : a.booth.company.localeCompare(b.booth.company)));
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();

/**
 * Narrow a floor's companies by what was typed and the picked category (industry). A match on the
 * company (name, industry, tagline) keeps all its vacancies; otherwise only the vacancies that match
 * (title, type, location) are kept, and companies left with none drop out. No query: everyone.
 */
export function filterCompanies(list: MapCompany[], query: string, category = ""): MapCompany[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const has = (text: string) => words.every((w) => text.includes(w));
  const out: MapCompany[] = [];
  for (const c of list) {
    if (category && c.booth.industry !== category) continue;
    if (!words.length || has(norm(`${c.booth.company} ${c.booth.industry} ${c.booth.tagline}`))) {
      out.push(c);
      continue;
    }
    const jobs = c.jobs.filter((j) => has(norm(`${j.title} ${j.type} ${j.location} ${j.city ?? ""} ${c.booth.company}`)));
    if (jobs.length) out.push({ ...c, jobs });
  }
  return out;
}

/** The categories to filter by: every industry with a company in the fair, A to Z. */
export const mapCategories = (booths: CompanyBooth[]) => [...new Set(booths.map((b) => b.industry).filter(Boolean))].sort((a, b) => a.localeCompare(b));

/** Where a point of the plan lands in the plan drawn `px` wide (for scrolling a stand into view). */
export const planScrollFor = (plan: Pick<FloorPlan, "width">, x: number, px: number, view: number) => Math.max(0, Math.min(px - view, (x / plan.width) * px - view / 2));
