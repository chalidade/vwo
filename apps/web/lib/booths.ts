import "server-only";
import { readFairState, writeFairState } from "@vwo/db";
import { type CompanyBooth, DEMO_JOB_FAIR } from "@vwo/shared";
import { randomInt } from "node:crypto";
import { db } from "./db";

/** Where a stand can stand on a hall floor; the same slots the game offers. */
export const SLOTS = [3, 20, 37].flatMap((x) => [0.4, 9.4].map((y) => ({ x, y })));

type Org = { removed?: string[]; added?: CompanyBooth[]; halls?: unknown[] };

export interface NewBooth {
  company: string;
  industry: string;
  color: string;
  contact: string;
  email: string;
  tier: "regular" | "premium";
  price: number;
  method: string;
  floor: number;
  x: number;
  y: number;
}

/**
 * Put a company's booth on a free slot of a hall floor, with a random portal PIN. The booth is kept
 * as its own `booking:<id>` document so an organiser saving the event setup can't overwrite it.
 */
export async function placeBooth(input: NewBooth, userId: string): Promise<{ booth: CompanyBooth; pin: string } | { error: "invalid_slot" | "slot_taken" }> {
  if (!SLOTS.some((s) => s.x === input.x && s.y === input.y)) return { error: "invalid_slot" };
  const rows = await readFairState(db);
  const org = (rows.find((r) => r.key === "org")?.data ?? {}) as Org;
  const removed = new Set(org.removed ?? []);
  const halls = org.halls?.length ?? DEMO_JOB_FAIR.floors.length;
  if (input.floor < 0 || input.floor >= halls) return { error: "invalid_slot" };
  const booked = rows.filter((r) => r.key.startsWith("booking:")).map((r) => (r.data as { booth: CompanyBooth }).booth);
  const standing = [...DEMO_JOB_FAIR.booths.filter((b) => !removed.has(b.id)), ...(org.added ?? []), ...booked.filter((b) => !removed.has(b.id))];
  if (standing.some((b) => b.floor === input.floor && b.x === input.x && b.y === input.y)) return { error: "slot_taken" };

  const taken = new Set([...DEMO_JOB_FAIR.booths, ...(org.added ?? []), ...booked].map((b) => b.id));
  const slug = input.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "stand";
  let id = slug;
  for (let n = 2; taken.has(id); n++) id = `${slug}-${n}`;
  const name = input.company;
  const booth: CompanyBooth = {
    id,
    company: name,
    tagline: `Bergabung bersama ${name}`,
    industry: input.industry || "Umum",
    logo: name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    color: input.color,
    floor: input.floor,
    tier: input.tier,
    x: input.x,
    y: input.y,
    recruiter: input.contact,
    email: input.email,
    about: `${name} membuka lowongan di job fair ini. Profil lengkap diisi perusahaan lewat portal perusahaan.`,
    faq: [{ q: "Bagaimana cara melamar?", a: "Pilih lowongan di banner stand lalu kirim lamaran." }],
    jobs: [{ id: `${id}-staff`, title: "Staff Umum", type: "Full-time", location: "Jakarta", requirements: ["Lulusan SMA/SMK/S1", "Komunikatif"] }],
  };
  const pin = String(randomInt(100000, 1000000));
  const booking = { id: `book-${Date.now().toString(36)}`, boothId: id, company: name, contact: input.contact, email: input.email, tier: input.tier, price: input.price, method: input.method, at: Date.now() };
  await writeFairState(db, { key: `booking:${id}`, data: { booth, booking, pin }, userId });
  return { booth, pin };
}

/** Whether a booth stands in the event now: published and not removed, added by the organiser, or booked. */
export async function boothStands(boothId: string) {
  const rows = await readFairState(db);
  const org = (rows.find((r) => r.key === "org")?.data ?? {}) as Org;
  if (org.removed?.includes(boothId)) return false;
  if (DEMO_JOB_FAIR.booths.some((b) => b.id === boothId) || org.added?.some((b) => b.id === boothId)) return true;
  return rows.some((r) => r.key.startsWith("booking:") && (r.data as { booth?: CompanyBooth }).booth?.id === boothId);
}
