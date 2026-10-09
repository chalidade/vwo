import { addBoothMember, readFairState, writeFairState } from "@vwo/db";
import { type CompanyBooth, DEMO_JOB_FAIR } from "@vwo/shared";
import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

/** Where a stand can stand on a hall floor; the same slots the game offers. */
const SLOTS = [3, 20, 37].flatMap((x) => [0.4, 9.4].map((y) => ({ x, y })));
const PRICES = { regular: 7_500_000, premium: 15_000_000 } as const;

const bookingSchema = z.object({
  company: z.string().trim().min(2).max(60),
  industry: z.string().trim().max(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  contact: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(120),
  tier: z.enum(["regular", "premium"]),
  method: z.string().trim().min(2).max(40),
  floor: z.number().int().min(0).max(20),
  x: z.number(),
  y: z.number(),
});

type Org = { removed?: string[]; added?: CompanyBooth[]; halls?: unknown[] };

/**
 * A company books an empty stand itself (demo payment). The booth is built here, not taken from the
 * browser, and kept as its own document so an organiser saving the event setup can't overwrite it.
 * The account that booked runs the booth straight away; the PIN is for its colleagues.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`booking:${user.id}`, 3, 3600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, bookingSchema);
  if ("error" in body) return body.error;
  const input = body.data;
  if (!SLOTS.some((s) => s.x === input.x && s.y === input.y)) return fail(400, "invalid_input");

  const rows = await readFairState(db);
  const org = (rows.find((r) => r.key === "org")?.data ?? {}) as Org;
  const removed = new Set(org.removed ?? []);
  const halls = org.halls?.length ?? DEMO_JOB_FAIR.floors.length;
  if (input.floor >= halls) return fail(400, "invalid_input");
  const booked = rows.filter((r) => r.key.startsWith("booking:")).map((r) => (r.data as { booth: CompanyBooth }).booth);
  const standing = [...DEMO_JOB_FAIR.booths.filter((b) => !removed.has(b.id)), ...(org.added ?? []), ...booked.filter((b) => !removed.has(b.id))];
  if (standing.some((b) => b.floor === input.floor && b.x === input.x && b.y === input.y)) return fail(409, "slot_taken");

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
  const pin = String(randomInt(1000, 10000));
  const booking = { id: `book-${Date.now().toString(36)}`, boothId: id, company: name, contact: input.contact, email: input.email, tier: input.tier, price: PRICES[input.tier], method: input.method, at: Date.now() };
  await writeFairState(db, { key: `booking:${id}`, data: { booth, booking, pin }, userId: user.id });
  await addBoothMember(db, id, user.id);
  return NextResponse.json({ booth, pin }, { status: 201 });
}
