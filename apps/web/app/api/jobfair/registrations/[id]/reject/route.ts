import { registrationById, rejectRegistration } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { sendMail } from "@/lib/mail";
import { currentUser } from "@/lib/session";

const schema = z.object({ note: z.string().trim().min(3).max(300) });

/** The organiser could not confirm the company: the registration is turned down with a reason. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!isFairAdmin(user)) return fail(403, "not_allowed");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "not_found");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const reg = await registrationById(db, id);
  if (!reg || !(await rejectRegistration(db, id, user!.id, body.data.note))) return fail(409, "not_open");
  await sendMail(reg.email, "Pendaftaran booth jobfair belum bisa diterima", `Halo ${reg.contactName},\n\nMaaf, pendaftaran ${reg.company} belum bisa kami terima.\nAlasan: ${body.data.note}\n\nBalas email ini kalau ada pertanyaan.\n\nSalam,\nPanitia jobfair`).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
