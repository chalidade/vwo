import "server-only";
import { putFairStateLocked, readFairState } from "@vwo/db";
import { type BoothTier, type CompanyBooth, DEMO_JOB_FAIR, type StandMoveError, type StandPlacements, STAND_SLOTS, hasStand, placeStands, planStandMove } from "@vwo/shared";
import { randomInt } from "node:crypto";
import { db } from "./db";

/** Where a stand can stand on a hall floor; the same slots the game offers. */
export const SLOTS = STAND_SLOTS;

type Org = { removed?: string[]; added?: CompanyBooth[]; halls?: unknown[] };
type Row = { key: string; data: unknown };

/** The organiser's stand moves live in their own document, written only by the move route, so an
 *  organiser saving the event setup from a browser that hasn't seen a move can't undo it. */
export const PLACEMENT_KEY = "placement";

/** The event's booths as they stand now, at the spot the organiser moved them to, and how many booth floors there are. */
export function standingBooths(rows: Row[]) {
  const org = (rows.find((r) => r.key === "org")?.data ?? {}) as Org;
  const removed = new Set(org.removed ?? []);
  const halls = org.halls?.length || DEMO_JOB_FAIR.floors.length;
  const booked = rows
    .filter((r) => r.key.startsWith("booking:"))
    .map((r) => (r.data as { booth?: CompanyBooth }).booth)
    .filter((b): b is CompanyBooth => !!b);
  const placements = ((rows.find((r) => r.key === PLACEMENT_KEY)?.data ?? {}) as { placements?: StandPlacements }).placements ?? {};
  const seen = new Set<string>();
  const list = [...DEMO_JOB_FAIR.booths, ...(org.added ?? []), ...booked].filter((b) => !removed.has(b.id) && !seen.has(b.id) && !!seen.add(b.id));
  const spots = placeStands(list, placements, halls);
  const booths = list.map((b) => ({ ...b, ...spots.get(b.id) }));
  return { booths, halls, placements, org, booked };
}

/**
 * The organiser moves a stand to slot `slot` of booth floor `floor`, or swaps it with the stand
 * there. Runs under the same lock as bookings, so a company can't book the slot in between.
 */
export async function moveStand(
  boothId: string,
  to: { floor: number; slot: number },
  userId: string,
): Promise<{ placements: StandPlacements; swapped: string | null } | { error: StandMoveError }> {
  let swapped: string | null = null;
  const r = await putFairStateLocked(db, "stands", userId, (rows) => {
    const { booths, halls, placements } = standingBooths(rows);
    const plan = planStandMove(booths, placements, boothId, to, halls);
    if ("error" in plan) return plan;
    swapped = plan.swapped;
    return { key: PLACEMENT_KEY, data: { placements: plan.placements } };
  });
  return "error" in r ? { error: r.error as StandMoveError } : { placements: (r.data as { placements: StandPlacements }).placements, swapped };
}

export interface NewBooth {
  company: string;
  industry: string;
  color: string;
  contact: string;
  email: string;
  tier: BoothTier;
  price: number;
  method: string;
  floor: number;
  x: number;
  y: number;
}

/**
 * Put a company's booth on a free slot of a hall floor, with a random portal PIN. A mini (UMKM)
 * booth takes no slot: it is listed in its floor's Pojok UMKM. The booth is kept as its own
 * `booking:<id>` document so an organiser saving the event setup can't overwrite it.
 */
export async function placeBooth(input: NewBooth, userId: string): Promise<{ booth: CompanyBooth; pin: string } | { error: "invalid_slot" | "slot_taken" }> {
  const stand = hasStand(input);
  if (!stand) input = { ...input, x: 0, y: 0 };
  else if (!SLOTS.some((s) => s.x === input.x && s.y === input.y)) return { error: "invalid_slot" };
  let made: { booth: CompanyBooth; pin: string } | null = null;
  // Under the stands lock: an organiser moving a stand onto this slot waits, and so does a second booking.
  const r = await putFairStateLocked(db, "stands", userId, (rows) => {
    const { booths, halls, placements, org, booked } = standingBooths(rows);
    if (input.floor < 0 || input.floor >= halls) return { error: "invalid_slot" };
    if (stand && booths.some((b) => hasStand(b) && b.floor === input.floor && b.x === input.x && b.y === input.y)) return { error: "slot_taken" };
    // Ids still named by a stand move are not given out again, so a new booth doesn't inherit an old one's spot.
    const taken = new Set([...DEMO_JOB_FAIR.booths, ...(org.added ?? []), ...booked].map((b) => b.id).concat(Object.keys(placements)));
    const slug =
      input.company
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 24) || "stand";
    let id = slug;
    for (let n = 2; taken.has(id); n++) id = `${slug}-${n}`;
    made = makeBooth(input, id, stand);
    const booking = {
      id: `book-${Date.now().toString(36)}`,
      boothId: id,
      company: input.company,
      contact: input.contact,
      email: input.email,
      tier: input.tier,
      price: input.price,
      method: input.method,
      at: Date.now(),
    };
    return { key: `booking:${id}`, data: { ...made, booking } };
  });
  if ("error" in r) return { error: r.error as "invalid_slot" | "slot_taken" };
  return made!;
}

function makeBooth(input: NewBooth, id: string, stand: boolean): { booth: CompanyBooth; pin: string } {
  const name = input.company;
  const booth: CompanyBooth = {
    id,
    company: name,
    tagline: `Bergabung bersama ${name}`,
    industry: input.industry || "Umum",
    logo: name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    color: input.color,
    floor: input.floor,
    tier: input.tier,
    x: input.x,
    y: input.y,
    recruiter: input.contact,
    // No email: the booth is public, and the address typed in the request is the contact person's own.
    // It stays in the booking for the organiser; the company adds a public address in its portal.
    about: `${name} membuka lowongan di job fair ini. Profil lengkap diisi perusahaan lewat portal perusahaan.`,
    faq: [{ q: "Bagaimana cara melamar?", a: stand ? "Pilih lowongan di banner stand lalu kirim lamaran." : "Buka daftar lowongan di Pojok UMKM lalu kirim lamaran." }],
    jobs: [{ id: `${id}-staff`, title: "Staff Umum", type: "Full-time", location: "Jakarta", requirements: ["Lulusan SMA/SMK/S1", "Komunikatif"] }],
  };
  return { booth, pin: String(randomInt(100000, 1000000)) };
}

/** A booth as it stands in the event now, with its company's own edits; null when it doesn't. */
export async function boothNow(boothId: string): Promise<CompanyBooth | null> {
  const rows = await readFairState(db);
  const base = standingBooths(rows).booths.find((b) => b.id === boothId);
  if (!base) return null;
  const doc = rows.find((r) => r.key === `company:${boothId}`)?.data as { edits?: Partial<CompanyBooth> } | undefined;
  // Where the stand stands is the organiser's, whatever the company's edits say.
  return { ...base, ...(doc?.edits ?? {}), floor: base.floor, x: base.x, y: base.y };
}

/** Every booth standing in the event now: published and not removed, added by the organiser, or booked. */
export async function standingBoothIds(): Promise<string[]> {
  return standingBooths(await readFairState(db)).booths.map((b) => b.id);
}

/** Whether a booth stands in the event now: published and not removed, added by the organiser, or booked. */
export const boothStands = async (boothId: string) => !!(await boothNow(boothId));
