import { type BoothHookRow, boothHook, checkHookUrl, deleteBoothHook, recordBoothHookDelivery, rotateBoothHookSecret, setBoothHook } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { postHook, resolvesPublic } from "@/lib/ats-hook";
import { boothStands } from "@/lib/booths";
import { db } from "@/lib/db";
import { canManageBooth } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const BOOTH = /^[\w-]{1,80}$/;
const putSchema = z.object({ url: z.string().trim().min(1).max(500), enabled: z.boolean().default(true) });
const postSchema = z.object({ action: z.enum(["rotate", "test"]) });

/** What the portal shows. The secret itself never goes back out after it was first shown. */
const hookOut = (h: BoothHookRow | null) =>
  h ? { url: h.url, enabled: h.enabled, lastStatus: h.lastStatus, lastAt: h.lastAt?.getTime() ?? null, updatedAt: h.updatedAt.getTime() } : null;

async function allowed(booth: string) {
  if (!BOOTH.test(booth)) return fail(404, "not_found");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await canManageBooth(user, booth))) return fail(403, "not_allowed");
  return user;
}

/** The booth's ATS webhook, without its secret. */
export async function GET(_req: Request, { params }: { params: Promise<{ booth: string }> }) {
  const { booth } = await params;
  const user = await allowed(booth);
  if (user instanceof Response) return user;
  return NextResponse.json({ hook: hookOut(await boothHook(db, booth)) }, { headers: { "Cache-Control": "no-store" } });
}

/** Set the URL (https, public addresses only). The first save makes the secret and returns it once. */
export async function PUT(req: Request, { params }: { params: Promise<{ booth: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const { booth } = await params;
  const user = await allowed(booth);
  if (user instanceof Response) return user;
  if (!(await allow(`hook:${user.id}`, 20, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, putSchema);
  if ("error" in body) return body.error;
  const checked = checkHookUrl(body.data.url);
  if ("error" in checked) return fail(400, checked.error);
  if (!(await resolvesPublic(checked.url.hostname))) return fail(400, "url_not_allowed");
  if (!(await boothStands(booth))) return fail(404, "not_found");
  const { row, secret } = await setBoothHook(db, { boothKey: booth, url: checked.url.toString(), enabled: body.data.enabled, userId: user.id });
  return NextResponse.json({ hook: hookOut(row), secret }, { headers: { "Cache-Control": "no-store" } });
}

/** Make a new secret (shown once), or send a test event and report how the ATS answered. */
export async function POST(req: Request, { params }: { params: Promise<{ booth: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const { booth } = await params;
  const user = await allowed(booth);
  if (user instanceof Response) return user;
  const body = await readBody(req, postSchema);
  if ("error" in body) return body.error;
  if (!(await allow(`hook-${body.data.action}:${booth}`, 10, 600_000))) return fail(429, "too_many_requests");
  if (body.data.action === "rotate") {
    const secret = await rotateBoothHookSecret(db, booth, user.id);
    return secret ? NextResponse.json({ secret }, { headers: { "Cache-Control": "no-store" } }) : fail(404, "not_found");
  }
  const hook = await boothHook(db, booth);
  if (!hook) return fail(404, "not_found");
  const r = await postHook(hook, "test", {
    booth,
    application: {
      id: "00000000-0000-0000-0000-000000000000",
      boothId: booth,
      jobId: "contoh",
      jobTitle: "Contoh lowongan",
      status: "Terkirim",
      appliedAt: new Date().toISOString(),
      candidate: { name: "Pelamar Contoh", email: "pelamar@example.com", phone: "081200000000" },
    },
  });
  await recordBoothHookDelivery(db, booth, r.status);
  return NextResponse.json({ status: r.status, error: r.error, hook: hookOut(await boothHook(db, booth)) });
}

/** Stop sending to the ATS and forget the secret. */
export async function DELETE(req: Request, { params }: { params: Promise<{ booth: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const { booth } = await params;
  const user = await allowed(booth);
  if (user instanceof Response) return user;
  return (await deleteBoothHook(db, booth)) ? NextResponse.json({ ok: true }) : fail(404, "not_found");
}
