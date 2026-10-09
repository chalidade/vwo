import { deleteFairState, registrationById, verifyRegistration } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { placeBooth } from "@/lib/booths";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { appUrl, sendMail } from "@/lib/mail";
import { currentUser } from "@/lib/session";

const schema = z.object({ floor: z.number().int().min(0).max(20), x: z.number(), y: z.number() });

/** The organiser checked the company is real: its booth goes up on the chosen slot with a portal PIN. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!isFairAdmin(user)) return fail(403, "not_allowed");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "not_found");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const reg = await registrationById(db, id);
  if (!reg) return fail(404, "not_found");
  if (reg.status !== "paid") return fail(409, "not_paid");
  const placed = await placeBooth(
    { company: reg.company, industry: reg.industry, color: reg.color, contact: reg.contactName, email: reg.email, tier: reg.tier === "premium" ? "premium" : "regular", price: reg.price, method: reg.method ?? "-", ...body.data },
    user!.id,
  );
  if ("error" in placed) return fail(409, placed.error);
  if (!(await verifyRegistration(db, id, user!.id, placed.booth.id, placed.pin))) {
    // Someone else decided first: take the booth back down.
    await deleteFairState(db, `booking:${placed.booth.id}`);
    return fail(409, "not_paid");
  }
  await sendMail(
    reg.email,
    "Pendaftaran booth jobfair terverifikasi",
    `Halo ${reg.contactName},\n\nPendaftaran ${reg.company} sudah diverifikasi panitia.\n\nKode perusahaan: ${placed.booth.id}\nPIN: ${placed.pin}\n\nMasuk dengan akun Google di ${appUrl()}/masuk-perusahaan lalu masukkan kode dan PIN di atas untuk mengelola booth, lowongan, dan pelamar. Bagikan kode dan PIN hanya ke tim HR kamu.\n\nSalam,\nPanitia jobfair`,
  ).catch(() => undefined);
  return NextResponse.json({ ok: true, boothId: placed.booth.id, pin: placed.pin });
}
