import { approveConsultant, readConsultants, rejectConsultant, removeConsultant, setBotsOff } from "@vwo/db";
import { BOT_CONSULTANTS, deskName, freeConsultDesks, isOpenNow } from "@vwo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { consultDesk } from "@/lib/consultants";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { appUrl, sendMail } from "@/lib/mail";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const userId = z.string().uuid();
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), user: userId, desk: consultDesk }),
  z.object({ action: z.literal("reject"), user: userId, note: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal("remove"), id: z.string().regex(/^k[0-9a-f]{12}$/) }),
  z.object({ action: z.literal("bots"), off: z.array(z.string().max(40)).max(20) }),
]);

const ERR_STATUS: Record<string, number> = { not_found: 404 };

/** The organiser's view of the lounge: every desk (with contacts), the applications and the bot switch. */
export async function GET() {
  if (!isFairAdmin(await currentUser())) return fail(403, "not_allowed");
  const s = await readConsultants(db);
  const now = Date.now();
  return NextResponse.json(
    {
      consultants: s.placed.map((d) => ({ ...d, open: isOpenNow(d, now) })).sort((a, b) => a.desk - b.desk),
      requests: s.requests.sort((a, b) => b.at - a.at),
      botsOff: s.botsOff,
      bots: BOT_CONSULTANTS.map((b, desk) => ({ id: b.id, name: b.name, role: b.role, desk })),
      freeDesks: freeConsultDesks(BOT_CONSULTANTS, s.botsOff, s.placed),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Approve an application onto a free desk, reject one, take a consultant off their desk, or switch bot consultants off. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!isFairAdmin(user)) return fail(403, "not_allowed");
  if (!(await allow(`consult-admin:${user!.id}`, 120, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const b = body.data;
  if (b.action === "approve") {
    const r = await approveConsultant(db, user!.id, b.user, b.desk);
    if ("error" in r) return fail(ERR_STATUS[r.error] ?? 409, r.error);
    const { doc, request } = r.result;
    await sendMail(
      request.email,
      "Kamu diterima sebagai konsultan jobfair",
      `Halo ${doc.profile.name},\n\nPanitia menerima pendaftaranmu sebagai konsultan. Kamu mendapat ${deskName(doc.desk)} di Lounge Konsultasi.\n\nBuka ${appUrl()}/play/#/jobfair/konsultan dengan akun yang sama, lalu tekan "Buka meja" saat kamu siap menerima panggilan dari pencari kerja.\n\nSalam,\nPanitia jobfair`,
    ).catch(() => undefined);
    return NextResponse.json({ ok: true, consultant: doc });
  }
  if (b.action === "reject") {
    const r = await rejectConsultant(db, user!.id, b.user, b.note);
    if ("error" in r) return fail(ERR_STATUS[r.error] ?? 409, r.error);
    await sendMail(
      r.result.email,
      "Pendaftaran konsultan jobfair belum bisa diterima",
      `Halo ${r.result.profile.name},\n\nMaaf, pendaftaranmu sebagai konsultan belum bisa kami terima.\nAlasan: ${b.note}\n\nKamu masih bisa membeli slot meja konsultan di ${appUrl()}/play/#/jobfair/konsultan.\n\nSalam,\nPanitia jobfair`,
    ).catch(() => undefined);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "remove") {
    const r = await removeConsultant(db, user!.id, b.id);
    if ("error" in r) return fail(ERR_STATUS[r.error] ?? 409, r.error);
    return NextResponse.json({ ok: true });
  }
  const r = await setBotsOff(db, user!.id, b.off);
  if ("error" in r) return fail(409, r.error);
  return NextResponse.json({ ok: true, botsOff: r.result });
}
