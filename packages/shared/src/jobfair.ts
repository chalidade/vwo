// A job fair as another kind of room: company booths instead of tables. Visitors walk between
// booths, ask the recruiter questions, read the hiring banners, and apply.
// Coordinates are tiles, like the cafe floors.
import { seatPositionsAround } from "./layout";
import type { FloorView, MapObjectView, SeatView, TableView } from "./venue-view";

export interface JobPosting {
  id: string;
  title: string;
  type: "Full-time" | "Kontrak" | "Magang" | "Part-time";
  location: string;
  /** Monthly range in millions of rupiah, e.g. "8–12 jt". */
  salary?: string;
  requirements: string[];
  /** What the job is about, written by the company in its portal. */
  description?: string;
  /** Closed vacancies stay in the company's list but no longer take applications. */
  closed?: boolean;
  /** Last day to apply, YYYY-MM-DD. */
  deadline?: string;
  /** How many people the company wants to hire. */
  quota?: number;
}

/** Vacancies still taking applications. */
export const openJobs = (b: { jobs: JobPosting[] }) => b.jobs.filter((j) => !j.closed);

/** Looks a company can pick for its booth in the company portal. */
export type BoothTheme = "classic" | "modern" | "wood" | "pastel" | "neon";
/** Look of the gate (gapura) at a booth's entrance. */
export type GateStyle = "klasik" | "janur" | "balon" | "neon";

export interface BoothFaq {
  q: string;
  a: string;
}

export interface CompanyBooth {
  id: string;
  company: string;
  tagline: string;
  industry: string;
  /** Short logo text (1–2 letters). */
  logo: string;
  color: string;
  /** Index into JobFairView.floors. */
  floor: number;
  /** Premium booths pay for a bigger presence: gold trim, spotlights, and a crown on the sign. */
  tier?: "premium" | "regular";
  /** Top-left corner of the booth, in tiles. Every booth is BOOTH_W × BOOTH_H. */
  x: number;
  y: number;
  recruiter: string;
  about: string;
  faq: BoothFaq[];
  jobs: JobPosting[];
  /** Photos of the booth's printed hiring banners. Shown before the generated job pages. */
  bannerImages?: { title: string; src: string }[];
  /** Company details for the "about us" page. */
  website?: string;
  email?: string;
  address?: string;
  founded?: number;
  employees?: string;
  socials?: { label: string; url: string }[];
  benefits?: string[];
  /** HR phone or WhatsApp number for applicants. */
  phone?: string;
  /** Set by the company in its portal. */
  theme?: BoothTheme;
  /** Decorations placed in the booth, by id (see the company portal catalogue). */
  accessories?: string[];
  /** Custom text for the VIP LED ticker. */
  ticker?: string;
  /** Lines the recruiter calls out to people walking by. */
  callouts?: string[];
  /** What visitors get when they tap the booth's paid decorations. */
  media?: BoothMedia;
  /** The company's walking promoter, once it bought one. */
  promoter?: BoothPromoter;
}

/** Content behind a booth's decorations, set in the company portal. */
/** The walking promoter a company pays for: who walks the hall for it and what they say. */
export interface BoothPromoter {
  name?: string;
  emoji?: string;
  headline?: string;
  offer?: string;
  code?: string;
  callouts?: string[];
}

export interface BoothMedia {
  /** Company video for the TV: a YouTube link or a video file URL. Without it the TV plays a slideshow. */
  videoUrl?: string;
  /** Brochure pages the mascot hands out. */
  brochure?: { title: string; text: string }[];
  /** Which mascot creature stands at the booth (see MASCOT_KINDS in the ui package), and its name. */
  mascot?: string;
  mascotName?: string;
  /** What the mascot says to people walking by. */
  mascotLine?: string;
  /** Free merchandise at the giveaway shelf, and how many are left. */
  merch?: { name: string; stock: number };
  /** The coffee cart's offer. */
  coffee?: string;
  /** Hashtag on the photo booth frame. */
  hashtag?: string;
  /** Employee stories told on the bean bags. */
  stories?: { name: string; role: string; text: string }[];
  /** The entrance gate's look and the words on its name plate. */
  gate?: GateStyle;
  gateText?: string;
}

/** A sponsor of the event: its logo on the hall wall and a standing banner on the floor. */
export interface SponsorView {
  id: string;
  name: string;
  tier: "Platinum" | "Gold" | "Silver";
  logo: string;
  color: string;
  tagline: string;
  about: string;
  website: string;
  /** Promo shown on the sponsor's banner and popup, e.g. a discount code. */
  promo?: string;
  /** Index into JobFairView.floors. */
  floor: number;
  /** Where its standing banner stands (tiles, top-left of a 0.9 × 0.45 footprint). */
  x: number;
  y: number;
  /** A photo of the sponsor's real banner, replacing the drawn one. */
  imageUrl?: string;
}

/** Footprint of a sponsor's standing banner. */
export const SPONSOR_W = 0.9;
export const SPONSOR_H = 0.45;

export const BOOTH_W = 6;
export const BOOTH_H = 3.6;

/** Points of interest inside a booth, relative to its top-left corner. */
export const BOOTH_SPOTS = {
  /** Where the recruiter stands, behind the desk. */
  recruiter: { x: 2.7, y: 1.55 },
  /** Where a visitor stands to talk to the recruiter. */
  talk: { x: 2.7, y: 3.25 },
  /** Where a visitor stands to read the roll-up banner. */
  banner: { x: 5.3, y: 2.85 },
};

/** How far a VIP booth's side wings reach past a regular booth on each side, in tiles. */
export const VIP_WING = 1;

type BoothShape = { x: number; y: number; tier?: "premium" | "regular"; accessories?: string[] };

/** VIP booths come with an entrance gate; others can add one. */
export const boothHasGate = (b: BoothShape) => b.tier === "premium" || !!b.accessories?.includes("gapura");

/** The booth's full width on the floor: VIP booths are wider by a wing on each side. */
export function boothFrame(b: BoothShape) {
  const wing = b.tier === "premium" ? VIP_WING : 0;
  return { x: b.x - wing, width: BOOTH_W + 2 * wing };
}

/** Solid parts of a booth: the back wall, the desk, the roll-up banner, and the gate's posts. */
export function boothParts(b: BoothShape) {
  const f = boothFrame(b);
  return [
    { part: "wall", x: f.x, y: b.y, width: f.width, height: 0.5 },
    { part: "desk", x: b.x + 1.2, y: b.y + 2.0, width: 3, height: 0.7 },
    { part: "rollup", x: b.x + 4.95, y: b.y + 1.65, width: 0.75, height: 0.45 },
    ...(boothHasGate(b)
      ? [
          { part: "gate", x: f.x + 0.05, y: b.y + BOOTH_H - 0.45, width: 0.45, height: 0.4 },
          { part: "gate", x: f.x + f.width - 0.5, y: b.y + BOOTH_H - 0.45, width: 0.45, height: 0.4 },
        ]
      : []),
  ];
}

export function boothSpot(b: { x: number; y: number }, spot: keyof typeof BOOTH_SPOTS) {
  return { x: b.x + BOOTH_SPOTS[spot].x, y: b.y + BOOTH_SPOTS[spot].y };
}

/** One level of the hall with company booths. Every floor has the same size; a lift connects them all. */
export interface FairFloorInfo {
  name: string;
  /** What kind of companies are on this floor, e.g. "Teknologi & Keuangan". */
  theme: string;
}

export interface JobFairView {
  slug: string;
  name: string;
  width: number;
  height: number;
  floors: FairFloorInfo[];
  /** Where visitors come in, on the ground floor. */
  spawn: { x: number; y: number };
  /** The organisers' info desk near the entrance, on the ground floor. */
  infoDesk: { x: number; y: number; width: number; height: number; staff: string };
  booths: CompanyBooth[];
  sponsors: SponsorView[];
  decor: { floor: number; spriteKey: string; x: number; y: number; width: number; height: number; isWalkable?: boolean }[];
  /** Whole floors above the halls: the food court, seminars, psychometric tests. */
  rooms: FairRoom[];
  /** Where visitors buy coins. */
  coinStand: CoinStandView;
  /** Sales people and event promoters walking the floors: paid ad placements. */
  promoters: Promoter[];
}

/** A promoter NPC who pitches a brand's offer when tapped. Sold to advertisers as ad space. */
export interface Promoter {
  id: string;
  /** The promoter's own name. */
  name: string;
  brand: string;
  emoji: string;
  color: string;
  /** Building level, 0-based, like FairStop.level. */
  level: number;
  x: number;
  y: number;
  headline: string;
  offer: string;
  /** Button text and where it goes (fictional, on the reserved .example domain). */
  cta: string;
  url: string;
  /** Promo code saved to the wallet, if the offer has one. */
  code?: string;
  /** What they call out to passers-by. */
  callouts: string[];
  /** Walks around the floor and goes up to visitors instead of standing still. */
  walks?: boolean;
  /** Switched off by the organiser: not shown. */
  active?: boolean;
  /** A company's own promoter: the button opens the booth's vacancies instead of a link. */
  boothId?: string;
}

export type FairRoomKind = "psikotes" | "seminar" | "foodcourt";

/** A whole floor of its own, reached by lift. Premium floors cost coins to enter. */
export interface FairRoom {
  id: string;
  kind: FairRoomKind;
  name: string;
  tagline: string;
  emoji: string;
  color: string;
  /** Building level, 0-based: level 3 is "Lantai 4". Halls take the levels below. */
  level: number;
  /** Entry price in coins; 0 is free. */
  price: number;
  width: number;
  height: number;
  /** Who runs the room: the proctor, the speaker, the food court host. */
  staff: { name: string; role: string };
  /** Food court stalls along the back wall. */
  stalls?: FoodStall[];
}

/** A food court stall: a real cafe or restaurant promoting its outlet and selling vouchers for it. */
export interface FoodStall {
  id: string;
  name: string;
  emoji: string;
  color: string;
  /** The owner or staff at the stall. */
  vendor: string;
  /** The pitch, one line. */
  promo: string;
  about: string;
  /** Where the real outlet is, and when it is open. */
  address: string;
  hours: string;
  /** Fictional site on the reserved .example domain. */
  website: string;
  rating: number;
  /** Signature dishes and their price at the outlet. */
  menu: { id: string; name: string; emoji: string; price: string }[];
  /** Vouchers for the outlet, bought here with coins. */
  deals: FoodDeal[];
}

export interface FoodDeal {
  id: string;
  title: string;
  /** What it is worth at the outlet, e.g. "Rp50.000". */
  worth: string;
  /** Price in coins. */
  price: number;
  terms: string;
}

export interface CoinStandView {
  floor: number;
  x: number;
  y: number;
  staff: string;
  packages: { id: string; coins: number; bonus: number; price: string }[];
}

export const COIN_STAND_W = 5.4;
export const COIN_STAND_H = 2.9;
/** Where to stand to buy coins, and where the cashier stands, relative to the stand. */
export const COIN_STAND_SPOTS = { staff: { x: 2.7, y: 1.0 }, front: { x: 2.7, y: 2.75 } };

export const fairRoomFloorId = (fair: { slug: string }, roomId: string) => `${fair.slug}-room-${roomId}`;

/** The lift lobby in the bottom-right corner of every floor: a wall with the lift doors. */
export const FAIR_LIFT = { x: 32.2, y: 16.6, width: 4.4, height: 1 };
/** Where you wait for the lift, and where you step out of it. */
export const LIFT_FRONT = { x: 34.4, y: 18.5 };

/** One stop of the lift: a hall floor with booths, or a floor that is a room. */
export interface FairStop {
  level: number;
  floorId: string;
  /** "Lantai 4" */
  name: string;
  /** What is there: the hall's theme or the room's name. */
  label: string;
  emoji: string;
  roomId?: string;
}

/** Every floor the lift stops at, bottom first. */
export function fairStops(fair: JobFairView): FairStop[] {
  return [
    ...fair.floors.map((f, i) => ({ level: i, floorId: fairFloorId(fair, i), name: f.name, label: f.theme, emoji: "💼" })),
    ...fair.rooms.map((r) => ({ level: r.level, floorId: fairRoomFloorId(fair, r.id), name: `Lantai ${r.level + 1}`, label: r.name, emoji: r.emoji, roomId: r.id })),
  ].sort((a, b) => a.level - b.level);
}

/** Stall geometry in the food court: four stalls spread along the back wall. */
export function stallRect(i: number) {
  return { x: 2.2 + i * 9.2, y: 0.3, width: 5.4, height: 2.4 };
}
export function stallSpot(i: number, spot: "vendor" | "order") {
  const s = stallRect(i);
  return spot === "vendor" ? { x: s.x + s.width / 2, y: s.y + 0.95 } : { x: s.x + s.width / 2, y: s.y + s.height + 0.7 };
}

/** Psikotes: rows of single desks facing the proctor. Seminar: rows of desks facing the stage. */
function roomFurniture(room: FairRoom): { tables: TableView[]; seats: SeatView[]; blocked: { x: number; y: number; width: number; height: number }[] } {
  const tables: TableView[] = [];
  const seats: SeatView[] = [];
  const blocked: { x: number; y: number; width: number; height: number }[] = [];
  const table = (label: string, shape: TableView["shape"], x: number, y: number, width: number, height: number) => {
    const t: TableView = { id: `${room.id}-${label}`, label, shape, x, y, width, height, rotation: 0 };
    tables.push(t);
    return t;
  };
  const seat = (t: TableView, i: number, x: number, y: number) =>
    seats.push({ id: `${t.id}-${String.fromCharCode(65 + i)}`, label: `${t.label}-${String.fromCharCode(65 + i)}`, tableId: t.id, x, y, isActive: true });
  if (room.kind === "psikotes") {
    blocked.push({ x: room.width / 2 - 2, y: 1.2, width: 4, height: 0.8 });
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 7; c++) {
        const t = table(`P${r * 7 + c + 1}`, "square", 3.6 + c * 4.6, 4 + r * 2.9, 1.4, 0.8);
        seat(t, 0, t.x + 0.7, t.y + 1.35);
      }
  } else if (room.kind === "seminar") {
    blocked.push({ x: 4, y: 0.3, width: room.width - 8, height: 2.6 });
    for (let r = 0; r < 5; r++)
      for (const [side, x0] of [["L", 3.5], ["R", room.width / 2 + 2.5]] as const) {
        const t = table(`${String.fromCharCode(65 + r)}${side}`, "rect", x0, 4.6 + r * 2.3, 10.6, 0.5);
        for (let i = 0; i < 7; i++) seat(t, i, t.x + 0.8 + i * 1.5, t.y + 1.0);
      }
  } else {
    (room.stalls ?? []).forEach((_, i) => {
      const s = stallRect(i);
      blocked.push({ x: s.x, y: s.y, width: s.width, height: 0.5 }, { x: s.x + 0.3, y: s.y + 1.45, width: s.width - 0.6, height: 0.7 });
    });
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 5; c++) {
        const t = table(`T${r * 5 + c + 1}`, "round", 2.6 + c * 6.6, 5.4 + r * 4.6, 1.8, 1.8);
        seatPositionsAround(t, 4).forEach((p, i) => seat(t, i, p.x, p.y));
      }
  }
  return { tables, seats, blocked };
}

/** The lift: a solid wall piece; you wait in front of it and pick a floor. */
function liftObject(floorId: string): MapObjectView {
  return { id: `${floorId}-lift`, type: "elevator", ...FAIR_LIFT, spriteKey: "lift", isWalkable: false, targetFloorId: null, targetX: null, targetY: null };
}

/** A room as a whole floor of its own, with the lift in the same corner as on the hall floors. */
export function buildFairRoom(fair: JobFairView, room: FairRoom): FloorView {
  const id = fairRoomFloorId(fair, room.id);
  const { tables, seats, blocked } = roomFurniture(room);
  const objects: MapObjectView[] = [
    liftObject(id),
    ...blocked.map((b, i): MapObjectView => ({ id: `${id}-obj-${i}`, type: "blocked", ...b, spriteKey: "invisible", isWalkable: false, targetFloorId: null, targetX: null, targetY: null })),
    ...[
      { key: "plant-a", spriteKey: "plant-big", x: 0.2, y: room.height - 1.6, width: 1.2, height: 1 },
      { key: "plant-b", spriteKey: "plant", x: room.width - 1.3, y: 13.4, width: 1, height: 1 },
      { key: "plant-c", spriteKey: "plant", x: 30.6, y: room.height - 1.3, width: 1, height: 1 },
    ].map(({ key, ...o }): MapObjectView => ({ id: `${id}-${key}`, type: "decor", ...o, isWalkable: false, targetFloorId: null, targetX: null, targetY: null })),
  ];
  return { id, name: room.name, width: room.width, height: room.height, tables, seats, objects, theme: "hall" };
}

export const fairFloorId = (fair: { slug: string }, floor: number) => `${fair.slug}-f${floor + 1}`;

/** The floor index of a floor id built by fairFloorId. */
export const fairFloorIndex = (floorId: string) => {
  const m = /-f(\d+)$/.exec(floorId);
  return m ? Number(m[1]) - 1 : -1;
};

/** One walkable floor of the hall: booths, sponsors and the info desk become obstacles. */
export function buildJobFairFloor(fair: JobFairView, floor = 0): FloorView {
  const id = fairFloorId(fair, floor);
  const objects: MapObjectView[] = [];
  const add = (o: Omit<MapObjectView, "id" | "targetFloorId" | "targetX" | "targetY">, target?: { floor: number; x: number; y: number }) =>
    objects.push({ ...o, id: `${id}-obj-${objects.length}`, targetFloorId: target ? fairFloorId(fair, target.floor) : null, targetX: target?.x ?? null, targetY: target?.y ?? null });
  for (const b of fair.booths) if (b.floor === floor) for (const p of boothParts(b)) add({ type: "blocked", x: p.x, y: p.y, width: p.width, height: p.height, spriteKey: "invisible", isWalkable: false });
  for (const sp of fair.sponsors) if (sp.floor === floor) add({ type: "blocked", x: sp.x, y: sp.y, width: SPONSOR_W, height: SPONSOR_H, spriteKey: "invisible", isWalkable: false });
  if (fair.coinStand.floor === floor) {
    const c = fair.coinStand;
    add({ type: "blocked", x: c.x, y: c.y, width: COIN_STAND_W, height: 0.5, spriteKey: "invisible", isWalkable: false });
    add({ type: "blocked", x: c.x + 0.4, y: c.y + 1.45, width: COIN_STAND_W - 0.8, height: 0.7, spriteKey: "invisible", isWalkable: false });
  }
  if (floor === 0) {
    const d = fair.infoDesk;
    add({ type: "blocked", x: d.x, y: d.y, width: d.width, height: d.height, spriteKey: "invisible", isWalkable: false });
    add({ type: "door", x: fair.spawn.x - 1, y: fair.height - 1, width: 2, height: 1, spriteKey: null, isWalkable: true });
  }
  objects.push(liftObject(id));
  const seats: SeatView[] = [];
  for (const o of fair.decor) {
    if (o.floor !== floor) continue;
    if (o.spriteKey === "sofa" || o.spriteKey === "sofa-left") {
      // Sofas to sit on: the cushions are walkable seats, only the backrest blocks.
      const right = o.spriteKey === "sofa";
      add({ type: "decor", x: o.x, y: o.y, width: o.width, height: o.height, spriteKey: o.spriteKey, isWalkable: true });
      add({ type: "blocked", x: right ? o.x : o.x + o.width - 0.3, y: o.y, width: 0.3, height: o.height, spriteKey: "invisible", isWalkable: false });
      const n = seats.length / 2 + 1;
      for (const [i, dy] of [0.7, o.height - 0.7].entries())
        seats.push({ id: `${id}-sofa${n}-${"AB"[i]}`, label: `Sofa ${n}${"AB"[i]}`, tableId: null, x: o.x + (right ? 0.65 : o.width - 0.65), y: o.y + dy, isActive: true, sofa: true, facing: right ? "right" : "left" });
      continue;
    }
    add({ type: "decor", x: o.x, y: o.y, width: o.width, height: o.height, spriteKey: o.spriteKey, isWalkable: o.isWalkable ?? false });
  }
  const info = fair.floors[floor];
  return { id, name: info ? `${info.name} · ${info.theme}` : fair.name, width: fair.width, height: fair.height, tables: [], seats, objects, theme: "hall" };
}

/** Every hall floor, then every room. */
export function buildJobFairFloors(fair: JobFairView): FloorView[] {
  return [...fair.floors.map((_, i) => buildJobFairFloor(fair, i)), ...fair.rooms.map((room) => buildFairRoom(fair, room))];
}

const job = (id: string, title: string, type: JobPosting["type"], location: string, salary: string | undefined, requirements: string[]): JobPosting => ({
  id,
  title,
  type,
  location,
  salary,
  requirements,
});

/** A booth with the usual contact details and FAQ derived from a few facts. */
function company(c: Omit<CompanyBooth, "website" | "email" | "socials" | "faq"> & { domain: string; does: string; process: string; extra: BoothFaq }): CompanyBooth {
  const { domain, does, process, extra, ...rest } = c;
  return {
    ...rest,
    website: `https://${domain}.example`,
    email: `karier@${domain}.example`,
    socials: [
      { label: "Instagram", url: `https://instagram.example/${domain}` },
      { label: "LinkedIn", url: `https://linkedin.example/company/${domain}` },
    ],
    faq: [{ q: "Perusahaan ini bergerak di bidang apa?", a: does }, extra, { q: "Bagaimana proses rekrutmennya?", a: process }],
  };
}

/** The demo job fair: three floors of six fictional companies each, sponsors, lounges, and an info desk by the door. */
export const DEMO_JOB_FAIR: JobFairView = {
  slug: "jobfair",
  name: "Job Fair VWO 2026",
  width: 38,
  height: 22,
  floors: [
    { name: "Lantai 1", theme: "Teknologi & Keuangan" },
    { name: "Lantai 2", theme: "Kreatif, Kuliner & Ritel" },
    { name: "Lantai 3", theme: "Industri, Energi & Kesehatan" },
  ],
  spawn: { x: 19, y: 21.2 },
  infoDesk: { x: 16.6, y: 17.2, width: 4.8, height: 0.7, staff: "Dewi" },
  sponsors: [
    {
      id: "telko-nusa",
      name: "Telko Nusa",
      tier: "Platinum",
      logo: "TN",
      color: "#dc2626",
      tagline: "Internet cepat sampai pelosok",
      about: "Penyedia internet dan seluler yang menghubungkan 80 juta pelanggan. Sponsor utama Job Fair VWO 2026.",
      website: "https://telkonusa.example",
      promo: "Kuota 20 GB gratis untuk pengunjung: kode JOBFAIR26",
      floor: 0,
      x: 11.05,
      y: 1.2,
    },
    {
      id: "kampus-digital",
      name: "Kampus Digital",
      tier: "Gold",
      logo: "KD",
      color: "#7c3aed",
      tagline: "Kursus online bersertifikat",
      about: "Platform belajar online untuk skill digital: coding, desain, data, dan pemasaran.",
      website: "https://kampusdigital.example",
      promo: "Diskon 50% kelas persiapan interview",
      floor: 0,
      x: 26.05,
      y: 1.2,
    },
    {
      id: "ojek-kita",
      name: "Ojek Kita",
      tier: "Gold",
      logo: "OK",
      color: "#059669",
      tagline: "Antar jemput ke interview",
      about: "Aplikasi ojek dan antar barang. Pengunjung job fair dapat potongan ongkos ke lokasi interview.",
      website: "https://ojekkita.example",
      promo: "Potongan Rp10.000 dengan kode INTERVIEW",
      floor: 1,
      x: 11.05,
      y: 1.2,
    },
    {
      id: "media-karier",
      name: "Media Karier",
      tier: "Silver",
      logo: "MK",
      color: "#0284c7",
      tagline: "Portal lowongan kerja",
      about: "Portal berita karier dan lowongan kerja. Media partner resmi job fair ini.",
      website: "https://mediakarier.example",
      floor: 1,
      x: 26.05,
      y: 1.2,
    },
    {
      id: "asuransi-aman",
      name: "Asuransi Aman",
      tier: "Silver",
      logo: "AA",
      color: "#1d4ed8",
      tagline: "Lindungi karier pertamamu",
      about: "Asuransi kesehatan dan jiwa untuk pekerja muda, mulai Rp30.000 per bulan.",
      website: "https://asuransiaman.example",
      promo: "Gratis 3 bulan pertama untuk pengunjung job fair",
      floor: 2,
      x: 11.05,
      y: 1.2,
    },
  ],
  decor: [
    // Ground floor: the coin stand on the left of the entrance, a lounge on the right.
    { floor: 0, spriteKey: "plant-big", x: 0.2, y: 5.6, width: 1.2, height: 1 },
    { floor: 0, spriteKey: "plant-big", x: 36.6, y: 5.6, width: 1.2, height: 1 },
    { floor: 0, spriteKey: "plant", x: 0.3, y: 20.6, width: 1, height: 1 },
    { floor: 0, spriteKey: "plant", x: 36.7, y: 13.8, width: 1, height: 1 },
    { floor: 0, spriteKey: "rug-plain", x: 23.6, y: 16.2, width: 6, height: 3.6, isWalkable: true },
    { floor: 0, spriteKey: "sofa", x: 23.9, y: 16.6, width: 1, height: 2.4 },
    { floor: 0, spriteKey: "sofa-left", x: 28.3, y: 16.6, width: 1, height: 2.4 },
    { floor: 0, spriteKey: "plant", x: 26.1, y: 16.4, width: 1, height: 1 },
    { floor: 0, spriteKey: "lamp", x: 13.4, y: 20.4, width: 0.8, height: 0.8 },
    { floor: 0, spriteKey: "lamp", x: 22.4, y: 20.4, width: 0.8, height: 0.8 },
    // Upper floors: one big lounge in the middle.
    ...[1, 2].flatMap((floor) => [
      { floor, spriteKey: "plant-big", x: 0.2, y: 5.6, width: 1.2, height: 1 },
      { floor, spriteKey: "plant-big", x: 36.6, y: 5.6, width: 1.2, height: 1 },
      { floor, spriteKey: "plant", x: 0.3, y: 20.6, width: 1, height: 1 },
      { floor, spriteKey: "plant", x: 36.7, y: 13.8, width: 1, height: 1 },
      { floor, spriteKey: "rug-plain", x: 13, y: 16.2, width: 12, height: 3.6, isWalkable: true },
      { floor, spriteKey: "sofa", x: 13.3, y: 16.6, width: 1, height: 2.4 },
      { floor, spriteKey: "sofa-left", x: 23.7, y: 16.6, width: 1, height: 2.4 },
      { floor, spriteKey: "plant", x: 18.5, y: 16.4, width: 1, height: 1 },
      { floor, spriteKey: "lamp", x: 27.6, y: 20.4, width: 0.8, height: 0.8 },
    ]),
  ],

  promoters: [
    {
      id: "promo-sepatu",
      name: "Dodi",
      brand: "Langkah Rapi",
      emoji: "👞",
      color: "#78350f",
      level: 0,
      x: 24,
      y: 13,
      headline: "Sepatu kerja diskon 35%",
      offer: "Sepatu pantofel dan sneakers kantor, nyaman dipakai seharian. Diskon 35% untuk pengunjung job fair.",
      cta: "Lihat sepatu",
      url: "https://langkahrapi.example/jobfair",
      code: "RAPI35",
      callouts: ["Interview pakai sepatu rapi yuk 👞", "Diskon 35% hari ini!"],
      walks: true,
    },
    {
      id: "promo-cv",
      name: "Wulan",
      brand: "CV Kilat",
      emoji: "📄",
      color: "#0284c7",
      level: 0,
      x: 24,
      y: 13,
      headline: "Cek CV gratis oleh HR",
      offer: "Unggah CV-mu, HR berpengalaman memberi catatan dalam 24 jam. Template CV ATS-friendly gratis.",
      cta: "Cek CV",
      url: "https://cvkilat.example",
      code: "CVGRATIS",
      callouts: ["CV-mu sudah lolos ATS? 📄", "Cek CV gratis, kak!"],
      walks: true,
    },
    {
      id: "promo-laptop",
      name: "Andre",
      brand: "SewaLaptop",
      emoji: "💻",
      color: "#475569",
      level: 1,
      x: 24,
      y: 13,
      headline: "Sewa laptop mulai Rp99 ribu/minggu",
      offer: "Butuh laptop untuk tes online atau kerja pertama? Sewa harian, mingguan, atau bulanan, bisa diantar.",
      cta: "Sewa laptop",
      url: "https://sewalaptop.example",
      code: "TESONLINE",
      callouts: ["Tes online tanpa laptop? Sewa aja 💻", "Diantar ke rumah!"],
      walks: true,
    },
    {
      id: "promo-salon",
      name: "Mira",
      brand: "Rapi Salon",
      emoji: "💇",
      color: "#db2777",
      level: 2,
      x: 24,
      y: 13,
      headline: "Potong rambut rapi Rp30 ribu",
      offer: "Tampil rapi sebelum interview. Potong dan styling di cabang mana pun, cukup tunjukkan kode.",
      cta: "Cari cabang",
      url: "https://rapisalon.example",
      code: "SIAPINTERVIEW",
      callouts: ["Rapiin rambut sebelum interview 💇", "Cuma Rp30 ribu!"],
      walks: true,
    },
    {
      id: "promo-ojol",
      name: "Fikri",
      brand: "Antar Makan",
      emoji: "🛵",
      color: "#ea580c",
      level: 2,
      x: 24,
      y: 13,
      headline: "Gratis ongkir 5x makan siang",
      offer: "Pesan makan siang dari kantor baru dengan gratis ongkir lima kali selama sebulan.",
      cta: "Pesan makan",
      url: "https://antarmakan.example",
      code: "MAKANSIANG",
      callouts: ["Lapar habis antre? Gratis ongkir! 🛵"],
      walks: true,
    },
    {
      id: "promo-ojek",
      name: "Gilang",
      brand: "Ojek Kita",
      emoji: "🛵",
      color: "#16a34a",
      level: 0,
      x: 24,
      y: 13,
      headline: "Diskon 50% ojek ke lokasi interview",
      offer: "Pulang dari job fair atau berangkat interview? Pakai kode ini untuk diskon 50% dua kali perjalanan.",
      cta: "Pesan ojek",
      url: "https://ojekkita.example/jobfair",
      code: "INTERVIEW50",
      callouts: ["Ojek murah ke lokasi interview! 🛵", "Diskon 50% buat pencari kerja!"],
      walks: true,
    },
    {
      id: "promo-foto",
      name: "Sekar",
      brand: "Studio Pas Foto",
      emoji: "📷",
      color: "#7c3aed",
      level: 1,
      x: 24,
      y: 13,
      headline: "Pas foto CV profesional Rp15 ribu",
      offer: "Foto CV latar polos, langsung jadi digital 5 menit. Tunjukkan kode di studio kami.",
      cta: "Lihat studio",
      url: "https://pasfoto.example/jobfair",
      code: "CVKECE",
      callouts: ["Foto CV kece, 5 menit jadi! 📷"],
      walks: true,
    },
    {
      id: "promo-telko",
      name: "Rani",
      brand: "Telko Nusa",
      emoji: "📶",
      color: "#e11d48",
      level: 0,
      x: 10.5,
      y: 19.4,
      headline: "Kuota 30 GB cuma Rp25 ribu",
      offer: "Khusus pengunjung job fair: paket internet 30 GB 30 hari, plus gratis 5 GB untuk video call interview.",
      cta: "Aktifkan paket",
      url: "https://telkonusa.example/jobfair",
      code: "NUSA30",
      callouts: ["Kuota murah buat interview online! 📶", "Mampir sebentar, ada promo kuota!", "Video call interview lancar jaya!"],
    },
    {
      id: "promo-kursus",
      name: "Bima",
      brand: "Kelas Koding Kita",
      emoji: "💻",
      color: "#2563eb",
      level: 0,
      x: 12,
      y: 7.4,
      headline: "Bootcamp coding, bayar setelah kerja",
      offer: "Belajar web developer 12 minggu dengan mentor industri. Daftar hari ini dapat potongan 40% dan kelas persiapan interview gratis.",
      cta: "Lihat kelas",
      url: "https://kelaskoding.example",
      code: "JOBFAIR40",
      callouts: ["Mau jadi programmer? Tanya aku! 💻", "Diskon 40% bootcamp hari ini!", "Belajar dulu, bayar setelah kerja"],
    },
    {
      id: "promo-bank",
      name: "Sinta",
      brand: "Tabungan Gajian",
      emoji: "🏦",
      color: "#0f766e",
      level: 1,
      x: 27,
      y: 7.4,
      headline: "Buka rekening gaji online, gratis admin",
      offer: "Rekening untuk karyawan baru: gratis biaya admin 12 bulan, kartu debit langsung jadi, bonus saldo Rp50.000.",
      cta: "Buka rekening",
      url: "https://tabungangajian.example",
      callouts: ["Gaji pertama? Simpan di sini! 🏦", "Gratis admin setahun!", "Buka rekening cuma 5 menit"],
    },
    {
      id: "promo-kos",
      name: "Yudi",
      brand: "KosDekat",
      emoji: "🏠",
      color: "#9333ea",
      level: 2,
      x: 12,
      y: 7.4,
      headline: "Kos dekat kantor barumu",
      offer: "Cari kos dan apartemen dekat kantor, bisa bayar bulanan. Diskon sewa bulan pertama 20% untuk pencari kerja.",
      cta: "Cari kos",
      url: "https://kosdekat.example",
      code: "KERJABARU",
      callouts: ["Udah dapat kerja? Cari kos di sini 🏠", "Diskon sewa bulan pertama!", "Kos dekat kantor, hemat ongkos"],
    },
    {
      id: "promo-minuman",
      name: "Lala",
      brand: "Segar Botol",
      emoji: "🥤",
      color: "#f59e0b",
      level: 3,
      x: 34.5,
      y: 8,
      headline: "Sampling gratis minuman isotonik",
      offer: "Coba rasa baru Segar Botol Lemon. Tunjukkan kode di minimarket mana pun untuk beli 2 gratis 1.",
      cta: "Lokasi minimarket",
      url: "https://segarbotol.example",
      code: "SEGAR21",
      callouts: ["Gratis cobain! 🥤", "Haus? Ada promo beli 2 gratis 1!", "Rasa lemon baru, segar banget"],
    },
  ],
  coinStand: {
    floor: 0,
    x: 2.4,
    y: 16,
    staff: "Mbak Koin",
    packages: [
      { id: "koin-50", coins: 50, bonus: 0, price: "Rp10.000" },
      { id: "koin-120", coins: 100, bonus: 20, price: "Rp20.000" },
      { id: "koin-300", coins: 250, bonus: 50, price: "Rp45.000" },
    ],
  },
  rooms: [
    {
      id: "foodcourt",
      kind: "foodcourt",
      name: "Food Court",
      tagline: "Promo cafe dan tempat makan, beli voucher pakai koin",
      emoji: "🍜",
      color: "#ea580c",
      level: 3,
      price: 0,
      width: 38,
      height: 22,
      staff: { name: "Bang Ucok", role: "Pengelola food court" },
      stalls: [
        {
          id: "bakso",
          name: "Bakso Mas Bro",
          emoji: "🍲",
          color: "#dc2626",
          vendor: "Mas Bro",
          promo: "Bakso urat jumbo, kuahnya bikin nagih",
          about: "Warung bakso keluarga sejak 2009, sekarang 3 cabang. Daging sapi pilihan, tanpa pengawet.",
          address: "Jl. Melati No. 12, dekat Stasiun Kota",
          hours: "10.00–22.00 setiap hari",
          website: "https://baksomasbro.example",
          rating: 4.7,
          menu: [
            { id: "bakso-urat", name: "Bakso urat jumbo", emoji: "🍲", price: "Rp25.000" },
            { id: "mie-ayam", name: "Mie ayam bakso", emoji: "🍜", price: "Rp20.000" },
          ],
          deals: [
            { id: "bakso-25", title: "Voucher makan Rp25.000", worth: "Rp25.000", price: 10, terms: "Berlaku di semua cabang, 30 hari." },
            { id: "bakso-b1g1", title: "Beli 1 gratis 1 bakso urat", worth: "Rp25.000", price: 14, terms: "Makan di tempat, Senin–Jumat." },
          ],
        },
        {
          id: "nasgor",
          name: "Nasi Goreng Gila",
          emoji: "🍛",
          color: "#ca8a04",
          vendor: "Pak Gila",
          promo: "Nasi goreng porsi kuli, buka sampai subuh",
          about: "Kedai nasi goreng kaki lima yang naik kelas jadi resto. Favorit anak kos dan pekerja shift malam.",
          address: "Ruko Sentosa Blok B-7, Jl. Pahlawan",
          hours: "17.00–03.00",
          website: "https://nasgorgila.example",
          rating: 4.5,
          menu: [
            { id: "nasgor-gila", name: "Nasi goreng gila", emoji: "🍛", price: "Rp22.000" },
            { id: "nasi-uduk", name: "Nasi uduk komplit", emoji: "🍚", price: "Rp18.000" },
          ],
          deals: [
            { id: "nasgor-20", title: "Voucher makan Rp20.000", worth: "Rp20.000", price: 8, terms: "Minimal belanja Rp30.000, 30 hari." },
            { id: "nasgor-paket", title: "Paket berdua hemat 30%", worth: "Rp15.000", price: 6, terms: "2 nasi goreng + 2 es teh." },
          ],
        },
        {
          id: "kopi",
          name: "Es Kopi Kita",
          emoji: "🧋",
          color: "#7c2d12",
          vendor: "Kak Tara",
          promo: "Kopi susu gula aren, cocok buat nugas",
          about: "Coffee shop lokal dengan Wi-Fi kencang dan colokan di tiap meja. Biji kopi dari petani Jawa Barat.",
          address: "Jl. Kenanga No. 3, seberang kampus",
          hours: "07.00–23.00",
          website: "https://eskopikita.example",
          rating: 4.8,
          menu: [
            { id: "es-kopi-susu", name: "Es kopi susu aren", emoji: "🧋", price: "Rp18.000" },
            { id: "croissant", name: "Croissant butter", emoji: "🥐", price: "Rp15.000" },
          ],
          deals: [
            { id: "kopi-free", title: "Gratis 1 es kopi susu", worth: "Rp18.000", price: 7, terms: "Tukar di kasir, 14 hari." },
            { id: "kopi-50", title: "Kartu kopi 5x minum", worth: "Rp90.000", price: 30, terms: "Hemat 40%, berlaku 60 hari." },
          ],
        },
        {
          id: "martabak",
          name: "Martabak Manis 88",
          emoji: "🥞",
          color: "#16a34a",
          vendor: "Koh Ahong",
          promo: "Martabak tebal, topping melimpah",
          about: "Resep turun-temurun sejak 1988. Terkenal dengan martabak cokelat keju dan red velvet.",
          address: "Jl. Sudirman No. 88 (depan pasar)",
          hours: "16.00–23.00",
          website: "https://martabak88.example",
          rating: 4.6,
          menu: [
            { id: "martabak-coklat", name: "Martabak cokelat keju", emoji: "🥞", price: "Rp45.000" },
            { id: "martabak-telur", name: "Martabak telur spesial", emoji: "🍳", price: "Rp40.000" },
          ],
          deals: [
            { id: "martabak-30", title: "Diskon Rp30.000 martabak", worth: "Rp30.000", price: 12, terms: "Untuk martabak ukuran besar." },
            { id: "martabak-topping", title: "Gratis 2 topping", worth: "Rp16.000", price: 5, terms: "Berlaku tiap hari, 30 hari." },
          ],
        },
      ],
    },
    {
      id: "psikotes",
      kind: "psikotes",
      name: "Ruang Psikotes",
      tagline: "Latihan psikotes, hasilnya dilihat recruiter",
      emoji: "🧠",
      color: "#7c3aed",
      level: 5,
      price: 20,
      width: 38,
      height: 22,
      staff: { name: "Bu Psikolog Rina", role: "Pengawas psikotes" },
    },
    {
      id: "seminar",
      kind: "seminar",
      name: "Ruang Seminar",
      tagline: "Seminar karier bersertifikat",
      emoji: "🎤",
      color: "#0e7490",
      level: 4,
      price: 15,
      width: 38,
      height: 22,
      staff: { name: "Pak Arif", role: "Pembicara" },
    },
  ],
  booths: [
    {
      id: "nusantara-tech",
      company: "Nusantara Tech",
      tagline: "Membangun aplikasi untuk 50 juta pengguna",
      industry: "Teknologi",
      logo: "NT",
      color: "#2563eb",
      floor: 0,
      tier: "premium",
      x: 1,
      y: 0.4,
      recruiter: "Bima",
      website: "https://nusantaratech.example",
      email: "karier@nusantaratech.example",
      address: "Jl. Sudirman Kav. 21, Jakarta",
      founded: 2014,
      employees: "1.200+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/nusantaratech" },
        { label: "LinkedIn", url: "https://linkedin.example/company/nusantaratech" },
      ],
      benefits: ["Kerja hybrid", "Budget belajar Rp10 jt/tahun", "Asuransi keluarga"],
      about: "Kami membuat aplikasi pembayaran dan belanja yang dipakai jutaan orang di Indonesia.",
      faq: [
        { q: "Perusahaan ini bergerak di bidang apa?", a: "Kami perusahaan teknologi: aplikasi pembayaran, belanja, dan logistik digital." },
        { q: "Budaya kerjanya seperti apa?", a: "Tim kecil yang lincah, kerja hybrid 3 hari di kantor, dan budget belajar tiap tahun." },
        { q: "Bagaimana proses rekrutmennya?", a: "Seleksi CV, tes coding online, wawancara teknis, lalu wawancara dengan user. Sekitar 2–3 minggu." },
      ],
      jobs: [
        job("nt-fe", "Frontend Developer", "Full-time", "Jakarta (Hybrid)", "12–18 jt", ["2+ tahun React atau Vue", "Paham TypeScript", "Portofolio aplikasi web"]),
        job("nt-be", "Backend Engineer (Go)", "Full-time", "Jakarta (Hybrid)", "15–22 jt", ["2+ tahun Go atau Java", "Pengalaman PostgreSQL", "Paham microservices"]),
        job("nt-ux", "UI/UX Designer Intern", "Magang", "Remote", "3 jt", ["Mahasiswa tingkat akhir", "Bisa Figma", "Punya portofolio desain"]),
      ],
    },
    {
      id: "kopi-kita",
      company: "Kopi Kita Group",
      tagline: "120 gerai kopi di 15 kota",
      industry: "F&B",
      logo: "KK",
      color: "#b45309",
      floor: 1,
      tier: "premium",
      x: 1,
      y: 0.4,
      recruiter: "Sinta",
      website: "https://kopikita.example",
      email: "karier@kopikita.example",
      address: "Jl. Braga 45, Bandung",
      founded: 2016,
      employees: "2.500+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/kopikita" },
        { label: "LinkedIn", url: "https://linkedin.example/company/kopikita" },
      ],
      benefits: ["Kopi gratis tiap shift", "Akademi barista", "Jenjang karier sampai Area Manager"],
      about: "Jaringan kedai kopi lokal dengan biji kopi dari petani Nusantara.",
      faq: [
        { q: "Perusahaan ini bergerak di bidang apa?", a: "Kami jaringan kedai kopi lokal, dari kebun sampai ke cangkir." },
        { q: "Ada pelatihan untuk pemula?", a: "Ada! Barista Trainee ikut akademi kopi kami selama 1 bulan, dibayar penuh." },
        { q: "Bagaimana proses rekrutmennya?", a: "Isi form, wawancara di gerai terdekat, lalu trial shift satu hari." },
      ],
      jobs: [
        job("kk-sm", "Store Manager", "Full-time", "Bandung, Surabaya", "8–11 jt", ["2+ tahun memimpin tim retail/F&B", "Siap kerja shift", "Kuat di layanan pelanggan"]),
        job("kk-barista", "Barista Trainee", "Kontrak", "Semua kota", "4,5–5,5 jt", ["Lulusan SMA/SMK", "Suka kopi dan bertemu orang", "Tidak perlu pengalaman"]),
        job("kk-scm", "Supply Chain Staff", "Full-time", "Jakarta", "7–9 jt", ["S1 Teknik Industri/Logistik", "Mahir Excel", "Teliti dengan data stok"]),
      ],
    },
    {
      id: "bank-sejahtera",
      company: "Bank Sejahtera",
      tagline: "Bank digital untuk semua",
      industry: "Perbankan",
      logo: "BS",
      color: "#0f766e",
      floor: 0,
      tier: "premium",
      x: 16,
      y: 0.4,
      recruiter: "Hendra",
      website: "https://banksejahtera.example",
      email: "karier@banksejahtera.example",
      address: "Jl. Thamrin 9, Jakarta",
      founded: 1998,
      employees: "15.000+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/banksejahtera" },
        { label: "LinkedIn", url: "https://linkedin.example/company/banksejahtera" },
      ],
      benefits: ["Program MT bersertifikat", "Tunjangan kesehatan lengkap", "Pinjaman karyawan berbunga rendah"],
      about: "Bank dengan layanan digital penuh dan 300 kantor cabang di seluruh Indonesia.",
      faq: [
        { q: "Apa itu program Management Trainee?", a: "Program 12 bulan rotasi di beberapa divisi, setelah itu langsung jadi Officer." },
        { q: "Fresh graduate boleh melamar?", a: "Boleh, Management Trainee memang untuk lulusan baru dengan IPK minimal 3,0." },
        { q: "Bagaimana proses rekrutmennya?", a: "Tes online, assessment center, wawancara HR, lalu wawancara direksi." },
      ],
      jobs: [
        job("bs-mt", "Management Trainee", "Full-time", "Jakarta", "9–10 jt", ["S1 semua jurusan, IPK ≥ 3,0", "Usia maksimal 26 tahun", "Siap ditempatkan di seluruh Indonesia"]),
        job("bs-ro", "Relationship Officer", "Full-time", "Medan, Makassar", "7–10 jt", ["1+ tahun di sales/perbankan", "Komunikatif", "Punya SIM C"]),
        job("bs-sec", "IT Security Analyst", "Full-time", "Jakarta", "14–20 jt", ["Paham OWASP dan SIEM", "Sertifikasi keamanan jadi nilai plus", "2+ tahun pengalaman"]),
      ],
    },
    {
      id: "gerak-logistik",
      company: "Gerak Logistik",
      tagline: "Kirim ke 7.000 pulau",
      industry: "Logistik",
      logo: "GL",
      color: "#ea580c",
      floor: 2,
      tier: "premium",
      x: 1,
      y: 0.4,
      recruiter: "Agus",
      website: "https://geraklogistik.example",
      email: "karier@geraklogistik.example",
      address: "Kawasan Industri Jababeka, Cikarang",
      founded: 2011,
      employees: "4.000+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/geraklogistik" },
        { label: "LinkedIn", url: "https://linkedin.example/company/geraklogistik" },
      ],
      benefits: ["Uang makan dan transport", "Asuransi kecelakaan kerja", "Bonus kinerja per kuartal"],
      about: "Perusahaan logistik dengan armada darat, laut, dan udara.",
      faq: [
        { q: "Perusahaan ini bergerak di bidang apa?", a: "Pengiriman barang dan pergudangan untuk e-commerce dan industri." },
        { q: "Kerja di gudang itu shift?", a: "Ya, ada 3 shift dengan uang makan dan tunjangan transport." },
        { q: "Bagaimana proses rekrutmennya?", a: "Seleksi CV, psikotes, wawancara, lalu tes kesehatan." },
      ],
      jobs: [
        job("gl-fleet", "Fleet Operations Staff", "Full-time", "Cikarang", "6–8 jt", ["D3/S1 semua jurusan", "Bisa koordinasi banyak pengemudi", "Siap kerja shift"]),
        job("gl-data", "Data Analyst", "Full-time", "Jakarta (Hybrid)", "10–14 jt", ["SQL dan Python", "Bisa membuat dashboard", "Paham statistik dasar"]),
        job("gl-wh", "Warehouse Supervisor", "Kontrak", "Surabaya", "7–9 jt", ["2+ tahun di gudang", "Paham WMS", "Tegas dan teliti"]),
      ],
    },
    {
      id: "hijau-energi",
      company: "Hijau Energi",
      tagline: "Listrik bersih dari matahari",
      industry: "Energi",
      logo: "HE",
      color: "#16a34a",
      floor: 2,
      tier: "premium",
      x: 16,
      y: 0.4,
      recruiter: "Laila",
      website: "https://hijauenergi.example",
      email: "karier@hijauenergi.example",
      address: "Jl. Bypass Ngurah Rai 88, Bali",
      founded: 2018,
      employees: "350+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/hijauenergi" },
        { label: "LinkedIn", url: "https://linkedin.example/company/hijauenergi" },
      ],
      benefits: ["Dinas ke seluruh Indonesia", "Pelatihan sertifikasi PLTS", "Saham karyawan"],
      about: "Kami memasang panel surya untuk rumah, pabrik, dan desa terpencil.",
      faq: [
        { q: "Perusahaan ini bergerak di bidang apa?", a: "Energi terbarukan: pemasangan dan perawatan panel surya." },
        { q: "Ada program magang?", a: "Ada, magang teknik 6 bulan dengan kesempatan diangkat jadi karyawan." },
        { q: "Bagaimana proses rekrutmennya?", a: "Seleksi CV, tes teknis, kunjungan lapangan, lalu wawancara." },
      ],
      jobs: [
        job("he-ee", "Electrical Engineer", "Full-time", "Bali, NTT", "11–15 jt", ["S1 Teknik Elektro", "Paham sistem PLTS", "Siap dinas ke lapangan"]),
        job("he-so", "Sustainability Officer", "Full-time", "Jakarta", "9–12 jt", ["S1 Teknik Lingkungan atau sejenis", "Bisa menulis laporan ESG", "Bahasa Inggris aktif"]),
        job("he-intern", "Engineering Intern", "Magang", "Bali", "3,5 jt", ["Mahasiswa teknik semester 6+", "Suka kerja lapangan", "Mau belajar"]),
      ],
    },
    {
      id: "kreatif-studio",
      company: "Kreatif Studio",
      tagline: "Agensi konten kreatif",
      industry: "Media & Kreatif",
      logo: "KS",
      color: "#db2777",
      floor: 1,
      tier: "premium",
      x: 16,
      y: 0.4,
      recruiter: "Rara",
      website: "https://kreatifstudio.example",
      email: "karier@kreatifstudio.example",
      address: "Jl. Kemang Raya 12, Jakarta",
      founded: 2017,
      employees: "180+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/kreatifstudio" },
        { label: "LinkedIn", url: "https://linkedin.example/company/kreatifstudio" },
      ],
      benefits: ["Remote penuh atau hybrid", "Laptop dan alat kreatif", "Cuti kreatif 5 hari"],
      about: "Kami membuat konten, video, dan kampanye media sosial untuk 80+ brand.",
      faq: [
        { q: "Perusahaan ini bergerak di bidang apa?", a: "Agensi kreatif: konten media sosial, video, dan kampanye brand." },
        { q: "Boleh kerja remote?", a: "Boleh, sebagian besar tim kami kerja hybrid atau remote penuh." },
        { q: "Bagaimana proses rekrutmennya?", a: "Kirim portofolio, studi kasus singkat, lalu wawancara dengan creative lead." },
      ],
      jobs: [
        job("ks-cc", "Content Creator", "Full-time", "Remote", "6–9 jt", ["Aktif di TikTok/Instagram", "Bisa editing video pendek", "Kreatif dan konsisten"]),
        job("ks-motion", "Motion Designer", "Full-time", "Jakarta (Hybrid)", "9–13 jt", ["After Effects", "Portofolio motion graphic", "1+ tahun pengalaman"]),
        job("ks-sm", "Social Media Specialist", "Part-time", "Remote", "4–6 jt", ["Paham analitik media sosial", "Menulis caption yang menarik", "Bisa kerja dengan target"]),
      ],
    },
    {
      id: "sehat-medika",
      company: "Sehat Medika",
      tagline: "Jaringan klinik di 40 kota",
      industry: "Kesehatan",
      logo: "SM",
      color: "#0891b2",
      floor: 2,
      x: 31,
      y: 0.4,
      recruiter: "Dokter Ayu",
      website: "https://sehatmedika.example",
      email: "karier@sehatmedika.example",
      address: "Jl. Diponegoro 70, Surabaya",
      founded: 2009,
      employees: "3.000+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/sehatmedika" },
        { label: "LinkedIn", url: "https://linkedin.example/company/sehatmedika" },
      ],
      benefits: ["Pemeriksaan kesehatan gratis", "Beasiswa S2 untuk tenaga medis", "Shift fleksibel"],
      about: "Jaringan klinik dan apotek yang melayani pasien umum dan BPJS.",
      faq: [
        { q: "Perusahaan ini bergerak di bidang apa?", a: "Klinik, apotek, dan layanan konsultasi dokter online." },
        { q: "Lulusan non-medis bisa melamar?", a: "Bisa, kami juga butuh tim IT, keuangan, dan layanan pelanggan." },
        { q: "Bagaimana proses rekrutmennya?", a: "Seleksi berkas, tes kompetensi, wawancara, lalu orientasi dua minggu." },
      ],
      jobs: [
        job("sm-nurse", "Perawat Klinik", "Full-time", "Surabaya, Malang", "6–8 jt", ["D3/S1 Keperawatan", "Punya STR aktif", "Siap kerja shift"]),
        job("sm-pharm", "Apoteker", "Full-time", "Semua kota", "8–11 jt", ["S1 Farmasi + Apoteker", "Punya SIPA", "Teliti dan ramah"]),
        job("sm-cs", "Customer Care", "Kontrak", "Remote", "4,5–6 jt", ["Komunikatif", "Bisa kerja shift", "Pengalaman call center jadi nilai plus"]),
      ],
    },
    {
      id: "pintar-edu",
      company: "Pintar Edu",
      tagline: "Belajar seru untuk 2 juta siswa",
      industry: "Pendidikan",
      logo: "PE",
      color: "#ca8a04",
      floor: 0,
      x: 1,
      y: 9.4,
      recruiter: "Kak Dian",
      website: "https://pintaredu.example",
      email: "karier@pintaredu.example",
      address: "Jl. Kaliurang Km 5, Yogyakarta",
      founded: 2019,
      employees: "450+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/pintaredu" },
        { label: "LinkedIn", url: "https://linkedin.example/company/pintaredu" },
      ],
      benefits: ["Kerja dari mana saja", "Akses semua kursus gratis", "Cuti ulang tahun"],
      about: "Aplikasi belajar untuk siswa SD sampai SMA, dengan video, latihan soal, dan tutor live.",
      faq: [
        { q: "Perusahaan ini bergerak di bidang apa?", a: "Teknologi pendidikan: aplikasi belajar dan les online." },
        { q: "Tutor harus lulusan pendidikan?", a: "Tidak harus, yang penting menguasai materi dan suka mengajar." },
        { q: "Bagaimana proses rekrutmennya?", a: "Seleksi CV, micro teaching 15 menit, lalu wawancara." },
      ],
      jobs: [
        job("pe-tutor", "Tutor Matematika", "Part-time", "Remote", "Rp150rb/sesi", ["Menguasai materi SMA", "Bisa mengajar online", "Sabar dan komunikatif"]),
        job("pe-curr", "Curriculum Developer", "Full-time", "Yogyakarta", "8–12 jt", ["S1 Pendidikan atau sejenis", "Paham Kurikulum Merdeka", "Bisa menulis materi"]),
        job("pe-mobile", "Mobile Developer", "Full-time", "Remote", "12–18 jt", ["2+ tahun Flutter atau React Native", "Paham REST API", "Portofolio aplikasi"]),
      ],
    },
    // Lantai 1 · Teknologi & Keuangan
    company({
      id: "dompet-kita",
      company: "Dompet Kita",
      tagline: "Dompet digital untuk 30 juta pengguna",
      industry: "Fintech",
      logo: "DK",
      color: "#4f46e5",
      floor: 0,
      x: 31,
      y: 0.4,
      recruiter: "Kevin",
      domain: "dompetkita",
      address: "Jl. Gatot Subroto 38, Jakarta",
      founded: 2016,
      employees: "900+ karyawan",
      benefits: ["Saham karyawan (ESOP)", "Makan siang gratis", "Kerja hybrid"],
      about: "Aplikasi dompet digital untuk bayar tagihan, transfer, dan belanja di jutaan merchant.",
      does: "Teknologi finansial: dompet digital, paylater, dan pembayaran merchant.",
      extra: { q: "Butuh latar belakang keuangan?", a: "Tidak harus. Tim produk dan engineering kami banyak dari jurusan lain." },
      process: "Seleksi CV, tes online, wawancara user, lalu wawancara HR. Sekitar 3 minggu.",
      jobs: [
        job("dk-pm", "Product Manager", "Full-time", "Jakarta (Hybrid)", "18–26 jt", ["3+ tahun mengelola produk digital", "Paham analitik data", "Komunikasi yang baik"]),
        job("dk-risk", "Risk Analyst", "Full-time", "Jakarta", "10–14 jt", ["S1 Statistika, Matematika, atau Ekonomi", "Bisa SQL", "Teliti"]),
        job("dk-ops", "Merchant Operations Intern", "Magang", "Jakarta", "3,5 jt", ["Mahasiswa tingkat akhir", "Suka bertemu orang", "Bisa Excel"]),
      ],
    }),
    company({
      id: "data-raya",
      company: "Data Raya AI",
      tagline: "AI untuk bisnis Indonesia",
      industry: "Data & AI",
      logo: "DR",
      color: "#0f766e",
      floor: 0,
      x: 16,
      y: 9.4,
      recruiter: "Nadia",
      domain: "dataraya",
      address: "Jl. Asia Afrika 8, Bandung",
      founded: 2020,
      employees: "150+ karyawan",
      benefits: ["Remote penuh", "GPU untuk eksperimen", "Konferensi tahunan dibiayai"],
      about: "Kami membangun chatbot, analitik, dan model AI berbahasa Indonesia untuk bank, retail, dan pemerintah.",
      does: "Kecerdasan buatan dan analitik data untuk perusahaan.",
      extra: { q: "Harus jago matematika?", a: "Untuk data scientist iya. Untuk analyst, logika dan SQL sudah cukup untuk mulai." },
      process: "Take-home test, presentasi hasil, lalu wawancara teknis.",
      jobs: [
        job("dr-ds", "Data Scientist", "Full-time", "Remote", "15–22 jt", ["Python dan machine learning", "Paham statistika", "Portofolio proyek data"]),
        job("dr-da", "Data Analyst", "Full-time", "Bandung (Hybrid)", "8–12 jt", ["SQL dan spreadsheet", "Bisa Looker atau Power BI", "Fresh graduate dipersilakan"]),
        job("dr-ml", "ML Engineer Intern", "Magang", "Remote", "4 jt", ["Mahasiswa Informatika", "Python", "Pernah melatih model"]),
      ],
    }),
    company({
      id: "toko-kita",
      company: "TokoKita",
      tagline: "Marketplace UMKM nomor satu",
      industry: "E-commerce",
      logo: "TK",
      color: "#ea580c",
      floor: 0,
      x: 31,
      y: 9.4,
      recruiter: "Sinta",
      domain: "tokokita",
      address: "Jl. Pemuda 60, Semarang",
      founded: 2015,
      employees: "2.000+ karyawan",
      benefits: ["Voucher belanja bulanan", "Asuransi kesehatan", "Cuti 18 hari"],
      about: "Marketplace yang membantu 5 juta UMKM berjualan online ke seluruh Indonesia.",
      does: "E-commerce: marketplace, iklan toko, dan pengiriman untuk UMKM.",
      extra: { q: "Ada posisi di luar Jakarta?", a: "Ada, kantor pusat kami di Semarang dan tim lapangan di 20 kota." },
      process: "Seleksi CV, psikotes online, wawancara user, lalu offering.",
      jobs: [
        job("tk-qa", "QA Engineer", "Full-time", "Semarang", "8–12 jt", ["Paham testing manual dan otomatis", "Bisa Cypress atau Playwright", "Teliti"]),
        job("tk-am", "Account Manager UMKM", "Full-time", "20 kota", "6–9 jt + bonus", ["Suka bertemu penjual", "Punya kendaraan sendiri", "Target oriented"]),
        job("tk-ads", "Digital Marketing", "Kontrak", "Semarang (Hybrid)", "7–10 jt", ["Pengalaman iklan Meta/Google", "Paham analitik", "Kreatif"]),
      ],
    }),
    // Lantai 2 · Kreatif, Kuliner & Ritel
    company({
      id: "mode-lokal",
      company: "Mode Lokal",
      tagline: "Fashion lokal, 85 toko",
      industry: "Ritel Fashion",
      logo: "ML",
      color: "#be185d",
      floor: 1,
      x: 31,
      y: 0.4,
      recruiter: "Bella",
      domain: "modelokal",
      address: "Jl. Braga 15, Bandung",
      founded: 2012,
      employees: "1.500+ karyawan",
      benefits: ["Diskon karyawan 40%", "Seragam gratis", "Jenjang karier ke store manager"],
      about: "Brand fashion lokal dengan 85 toko dan toko online, dari kaos sampai batik modern.",
      does: "Ritel fashion: desain, produksi, dan toko di mal seluruh Indonesia.",
      extra: { q: "Harus berpengalaman di ritel?", a: "Untuk fashion advisor tidak, kami latih dari awal." },
      process: "Walk-in interview di stand ini, lalu tes praktik di toko.",
      jobs: [
        job("ml-fa", "Fashion Advisor", "Full-time", "Mal di 12 kota", "4,5–5,5 jt", ["Min. SMA/SMK", "Ramah dan rapi", "Siap kerja shift"]),
        job("ml-vm", "Visual Merchandiser", "Full-time", "Bandung", "6–8 jt", ["Paham penataan toko", "Punya selera fashion", "Bisa desain dasar"]),
        job("ml-design", "Junior Fashion Designer", "Full-time", "Bandung", "6–9 jt", ["Lulusan desain mode", "Bisa Illustrator", "Portofolio koleksi"]),
      ],
    }),
    company({
      id: "pasar-segar",
      company: "Pasar Segar",
      tagline: "Supermarket segar 60 cabang",
      industry: "Ritel",
      logo: "PS",
      color: "#16a34a",
      floor: 1,
      x: 1,
      y: 9.4,
      recruiter: "Pak Joko",
      domain: "pasarsegar",
      address: "Jl. Ahmad Yani 101, Surabaya",
      founded: 2005,
      employees: "5.000+ karyawan",
      benefits: ["BPJS lengkap", "Uang makan dan transport", "Program management trainee"],
      about: "Jaringan supermarket yang menjual sayur, buah, dan daging segar langsung dari petani.",
      does: "Ritel bahan makanan: supermarket, gudang, dan belanja online.",
      extra: { q: "Ada program untuk fresh graduate?", a: "Ada, Management Trainee 12 bulan dengan rotasi ke semua divisi." },
      process: "Seleksi CV, psikotes, wawancara HR, lalu wawancara manajer area.",
      jobs: [
        job("ps-mt", "Management Trainee", "Full-time", "Surabaya", "7–9 jt", ["S1 semua jurusan", "IPK min. 3,00", "Siap ditempatkan di mana saja"]),
        job("ps-cashier", "Kasir", "Full-time", "60 cabang", "4–5 jt", ["Min. SMA/SMK", "Jujur dan teliti", "Siap kerja shift"]),
        job("ps-buyer", "Buyer Produk Segar", "Full-time", "Surabaya", "8–11 jt", ["Pengalaman pengadaan", "Bisa negosiasi", "Paham kualitas produk segar"]),
      ],
    }),
    company({
      id: "hotel-nusa",
      company: "Hotel Nusa Indah",
      tagline: "22 hotel dan resor",
      industry: "Perhotelan",
      logo: "HN",
      color: "#b45309",
      floor: 1,
      x: 16,
      y: 9.4,
      recruiter: "Bu Ratna",
      domain: "hotelnusaindah",
      address: "Jl. Raya Kuta 88, Bali",
      founded: 1998,
      employees: "4.000+ karyawan",
      benefits: ["Makan di hotel", "Menginap gratis di jaringan hotel", "Service charge"],
      about: "Jaringan hotel dan resor di Bali, Lombok, Yogyakarta, dan Labuan Bajo.",
      does: "Perhotelan dan pariwisata: hotel, resor, dan restoran.",
      extra: { q: "Harus bisa bahasa asing?", a: "Bahasa Inggris wajib untuk front office. Bahasa lain jadi nilai plus." },
      process: "Wawancara, tes bahasa Inggris, lalu masa percobaan 3 bulan.",
      jobs: [
        job("hn-fo", "Front Office Agent", "Full-time", "Bali, Lombok", "5–7 jt", ["Lulusan perhotelan", "Bahasa Inggris aktif", "Berpenampilan rapi"]),
        job("hn-cook", "Cook Helper", "Kontrak", "Bali", "4,5–6 jt", ["Lulusan tata boga", "Paham higiene dapur", "Siap kerja shift"]),
        job("hn-intern", "Hotel Operations Intern", "Magang", "Yogyakarta", "2,5 jt", ["Mahasiswa pariwisata", "Magang 6 bulan", "Siap rotasi divisi"]),
      ],
    }),
    company({
      id: "gim-nusantara",
      company: "Gim Nusantara",
      tagline: "Studio gim dengan 10 juta pemain",
      industry: "Gim & Hiburan",
      logo: "GN",
      color: "#9333ea",
      floor: 1,
      x: 31,
      y: 9.4,
      recruiter: "Arya",
      domain: "gimnusantara",
      address: "Jl. Magelang Km 6, Yogyakarta",
      founded: 2018,
      employees: "120+ karyawan",
      benefits: ["Jam kerja fleksibel", "Game night tiap Jumat", "Laptop dan konsol"],
      about: "Studio gim mobile yang membuat gim bertema budaya Indonesia, dimainkan di 40 negara.",
      does: "Pengembangan gim mobile dan PC.",
      extra: { q: "Harus jago main gim?", a: "Tidak, tapi kami suka orang yang paham kenapa sebuah gim seru." },
      process: "Kirim portofolio, art atau coding test, lalu wawancara dengan lead.",
      jobs: [
        job("gn-unity", "Unity Developer", "Full-time", "Yogyakarta (Hybrid)", "10–16 jt", ["C# dan Unity", "Pernah rilis gim", "Paham optimasi mobile"]),
        job("gn-2d", "2D Artist", "Full-time", "Yogyakarta", "7–11 jt", ["Portofolio ilustrasi karakter", "Bisa Photoshop atau Krita", "Paham animasi dasar"]),
        job("gn-qa", "Game Tester", "Part-time", "Remote", "3–4 jt", ["Teliti", "Bisa menulis laporan bug", "Suka main gim mobile"]),
      ],
    }),
    // Lantai 3 · Industri, Energi & Kesehatan
    company({
      id: "baja-prima",
      company: "Baja Prima",
      tagline: "Pabrik baja ringan sejak 1990",
      industry: "Manufaktur",
      logo: "BP",
      color: "#475569",
      floor: 2,
      x: 1,
      y: 9.4,
      recruiter: "Pak Hendra",
      domain: "bajaprima",
      address: "Kawasan Industri Jababeka, Cikarang",
      founded: 1990,
      employees: "2.500+ karyawan",
      benefits: ["Mes karyawan", "Bus antar jemput", "Bonus produksi"],
      about: "Produsen baja ringan dan atap untuk perumahan dan gedung di seluruh Indonesia.",
      does: "Manufaktur baja ringan, atap, dan rangka bangunan.",
      extra: { q: "Lulusan SMK bisa melamar?", a: "Bisa, operator produksi kami banyak dari SMK teknik." },
      process: "Seleksi berkas, tes fisik dan kesehatan, lalu wawancara.",
      jobs: [
        job("bp-op", "Operator Produksi", "Kontrak", "Cikarang", "5–5,5 jt", ["SMK Teknik Mesin atau Elektro", "Sehat jasmani", "Siap kerja shift"]),
        job("bp-qc", "Quality Control", "Full-time", "Cikarang", "6–8 jt", ["D3/S1 Teknik", "Paham standar SNI", "Teliti"]),
        job("bp-ppic", "PPIC Staff", "Full-time", "Cikarang", "7–9 jt", ["S1 Teknik Industri", "Bisa Excel dan ERP", "Pengalaman 1 tahun"]),
      ],
    }),
    company({
      id: "bangun-jaya",
      company: "Bangun Jaya Konstruksi",
      tagline: "Membangun jalan dan jembatan",
      industry: "Konstruksi",
      logo: "BJ",
      color: "#f59e0b",
      floor: 2,
      x: 16,
      y: 9.4,
      recruiter: "Bu Wulan",
      domain: "bangunjaya",
      address: "Jl. MT Haryono 47, Jakarta",
      founded: 1985,
      employees: "6.000+ karyawan",
      benefits: ["Tunjangan proyek", "Asuransi kecelakaan kerja", "Sertifikasi K3 dibiayai"],
      about: "Kontraktor jalan tol, jembatan, dan gedung di 25 provinsi.",
      does: "Konstruksi infrastruktur: jalan tol, jembatan, bendungan, dan gedung.",
      extra: { q: "Apakah ditempatkan di proyek luar kota?", a: "Ya, sebagian besar posisi lapangan berpindah sesuai proyek." },
      process: "Seleksi CV, psikotes, tes teknis, lalu medical check-up.",
      jobs: [
        job("bj-se", "Site Engineer", "Full-time", "Proyek di Sumatra", "9–13 jt", ["S1 Teknik Sipil", "Bisa AutoCAD", "Siap ditempatkan di proyek"]),
        job("bj-k3", "Petugas K3", "Kontrak", "Jakarta", "6–8 jt", ["Sertifikat Ahli K3 Umum", "Tegas dan disiplin", "Pengalaman 1 tahun"]),
        job("bj-drafter", "Drafter", "Full-time", "Jakarta", "6–8 jt", ["D3 Teknik Sipil atau Arsitektur", "Mahir AutoCAD dan Revit", "Teliti"]),
      ],
    }),
    company({
      id: "agro-tani",
      company: "Agro Tani Makmur",
      tagline: "Pangan dari 50.000 petani mitra",
      industry: "Agribisnis",
      logo: "AT",
      color: "#65a30d",
      floor: 2,
      x: 31,
      y: 9.4,
      recruiter: "Mas Wahyu",
      domain: "agrotani",
      address: "Jl. Soekarno Hatta 9, Malang",
      founded: 2011,
      employees: "1.100+ karyawan",
      benefits: ["Kendaraan operasional", "Tunjangan lapangan", "Pelatihan pertanian modern"],
      about: "Kami membeli hasil panen petani mitra, mengolahnya, dan menyalurkannya ke pabrik dan pasar.",
      does: "Agribisnis: kemitraan petani, pengolahan hasil panen, dan distribusi pangan.",
      extra: { q: "Kerjanya banyak di lapangan?", a: "Untuk field officer iya, kamu akan mendampingi petani di desa." },
      process: "Seleksi CV, wawancara, lalu kunjungan lapangan satu hari.",
      jobs: [
        job("at-fo", "Field Officer", "Full-time", "Jawa Timur", "5,5–7 jt", ["S1 Pertanian atau Agribisnis", "Punya SIM C", "Suka bekerja dengan petani"]),
        job("at-sc", "Supply Chain Analyst", "Full-time", "Malang", "8–11 jt", ["S1 Teknik Industri atau Logistik", "Bisa Excel tingkat lanjut", "Analitis"]),
        job("at-lab", "Analis Laboratorium", "Full-time", "Malang", "5,5–7 jt", ["D3/S1 Kimia atau Teknologi Pangan", "Paham uji mutu", "Teliti"]),
      ],
    }),
  ],
};
