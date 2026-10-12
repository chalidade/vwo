import { addBoothMember, deleteFairState, finishLead, leadById, recordLeadRegistration } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { placeBooth } from "@/lib/booths";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { appUrl, sendMail } from "@/lib/mail";
import { currentUser } from "@/lib/session";
import { leadStallKey, placeLeadStall } from "@/lib/stalls";

const booth = z.object({
  floor: z.number().int().min(0).max(20),
  x: z.number().finite(),
  y: z.number().finite(),
  tier: z.enum(["mini", "regular", "premium"]),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#2563eb"),
});
const stall = z.object({ slot: z.number().int().min(0).max(40) });

/**
 * The organiser agreed with the company or the food business: open its booth (with a portal PIN,
 * mailed to the contact, and the requesting account made its manager) or its food court stall, and
 * mark the request done. No payment is asked for. A request is fulfilled once; when two organisers
 * do it at the same time, the second one's booth or stall is taken down again.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!isFairAdmin(user)) return fail(403, "not_allowed");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "not_found");
  const lead = await leadById(db, id);
  if (!lead) return fail(404, "not_found");
  if (lead.result || (lead.status !== "new" && lead.status !== "contacted")) return fail(409, "not_open");

  if (lead.kind === "stall") {
    const body = await readBody(req, stall);
    if ("error" in body) return body.error;
    const placed = await placeLeadStall(lead, body.data.slot, user!.id);
    if ("error" in placed) return fail(409, placed.error);
    const done = await finishLead(db, id, user!.id, { stallId: placed.stall.id });
    if ("error" in done) {
      await deleteFairState(db, leadStallKey(id));
      return fail(409, done.error);
    }
    await sendMail(
      lead.email,
      "Stan food court kamu sudah buka",
      `Halo ${lead.contactName},\n\nStan ${lead.name} sudah dibuka panitia di Food Court jobfair. Masuk ke ${appUrl()}/play/ dengan akun yang dipakai saat mengisi formulir untuk melihatnya.\n\nSalam,\nPanitia jobfair`,
    ).catch(() => undefined);
    return NextResponse.json({ ok: true, stallId: placed.stall.id, lead: done.result });
  }

  const body = await readBody(req, booth);
  if ("error" in body) return body.error;
  const { tier, color, ...slot } = body.data;
  const placed = await placeBooth(
    { company: lead.name, industry: lead.industry ?? "", color, contact: lead.contactName, email: lead.email, tier, price: 0, method: "Formulir", ...slot },
    user!.id,
  );
  if ("error" in placed) return fail(409, placed.error);
  const done = await finishLead(db, id, user!.id, { boothId: placed.booth.id, pin: placed.pin });
  if ("error" in done) {
    // Someone else finished it first: take this booth back down.
    await deleteFairState(db, `booking:${placed.booth.id}`);
    return fail(409, done.error);
  }
  if (lead.userId) {
    // The account that asked runs the booth straight away, and counts as a verified company before launch.
    await addBoothMember(db, placed.booth.id, lead.userId).catch((e) => console.warn("lead booth member not added", id, e));
    await recordLeadRegistration(db, lead, user!.id, placed.booth.id, placed.pin, tier, color).catch((e) => console.warn("lead registration not recorded", id, e));
  }
  await sendMail(
    lead.email,
    "Booth jobfair kamu sudah dibuat",
    `Halo ${lead.contactName},\n\nBooth ${lead.name} sudah dibuat panitia.\n\nKode perusahaan: ${placed.booth.id}\nPIN: ${placed.pin}\n\n${lead.userId ? "Akun yang kamu pakai saat mengisi formulir sudah langsung jadi pengelola booth ini. Rekan kerja masuk" : "Masuk"} dengan akun Google di ${appUrl()}/masuk-perusahaan lalu masukkan kode dan PIN di atas untuk mengelola booth, lowongan, dan pelamar. Bagikan kode dan PIN hanya ke tim HR kamu.\n\nSalam,\nPanitia jobfair`,
  ).catch(() => undefined);
  return NextResponse.json({ ok: true, boothId: placed.booth.id, pin: placed.pin, lead: done.result });
}
