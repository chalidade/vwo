import { earlyAccessList, grantEarlyAccess, revokeEarlyAccess } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { appUrl, sendMail } from "@/lib/mail";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(200),
    role: z.enum(["seeker", "company"]),
    boothKey: z.string().regex(/^[\w-]{1,80}$/).nullish(),
    note: z.string().trim().max(200).nullish(),
    invite: z.boolean().optional(),
  })
  .refine((v) => v.role === "seeker" || !!v.boothKey, { path: ["boothKey"], message: "required" });

/** Everyone who may use the app before launch, for the organiser. */
export async function GET() {
  if (!isFairAdmin(await currentUser())) return fail(403, "not_allowed");
  const rows = await earlyAccessList(db);
  return NextResponse.json({ testers: rows.map((r) => ({ email: r.email, role: r.role, boothKey: r.boothKey, note: r.note, since: r.createdAt.getTime() })) });
}

/** The organiser adds a tester (or changes one), and may email them how to get in. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!isFairAdmin(user)) return fail(403, "not_allowed");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const { email, role, boothKey, note, invite } = body.data;
  const row = await grantEarlyAccess(db, { email, role, boothKey, note, addedBy: user!.id });
  if (invite) {
    const how =
      role === "company"
        ? `Kamu bisa mencoba portal perusahaan untuk stand "${boothKey}": kelola booth, lowongan, dan pelamar.\n\nMasuk dengan akun Google ${email} di ${appUrl()}/masuk-perusahaan`
        : `Kamu bisa mencoba job fair sebagai pencari kerja: jelajahi stand, lamar lowongan, ikut seminar.\n\nMasuk dengan akun Google ${email} di ${appUrl()}/masuk`;
    await sendMail(email, "Undangan early access jobfair.co.id", `Halo,\n\nKamu diundang mencoba jobfair.co.id sebelum dibuka untuk umum.\n${how}\n\nAplikasi ini belum rilis, jadi mohon tidak dibagikan dulu. Kabari kami kalau menemukan masalah.\n\nSalam,\nPanitia jobfair`).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, tester: { email: row.email, role: row.role, boothKey: row.boothKey, note: row.note, since: row.createdAt.getTime() } });
}

/** The organiser takes a tester off the list; a company tester also loses the trial booth. */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  if (!isFairAdmin(await currentUser())) return fail(403, "not_allowed");
  const email = new URL(req.url).searchParams.get("email") ?? "";
  if (!email || email.length > 200) return fail(400, "invalid_input");
  return (await revokeEarlyAccess(db, email)) ? NextResponse.json({ ok: true }) : fail(404, "not_found");
}
