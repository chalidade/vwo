import { claimPrereg, linkPreregistrations, markPreregWelcomed, myPreregistrations } from "@vwo/db";
import { normalizePreregCode, preregDate } from "@vwo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, readSizedBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Mine = Awaited<ReturnType<typeof myPreregistrations>>;
const view = (rows: Mine) => rows.map((r) => ({ code: r.code, name: r.event.name, slug: r.event.slug, date: preregDate(r.event), location: r.event.location }));

/**
 * The events this account joined by pre-registering, and whether to say "data pra-registrasi kamu
 * sudah terpasang" (once). Sign-ups made with the account's verified email are linked here too, for
 * an account that was already signed in when it registered.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (user.emailVerifiedAt) await linkPreregistrations(db, user).catch(() => undefined);
  const rows = await myPreregistrations(db, user.id);
  const fresh = rows.filter((r) => !r.welcomedAt);
  return NextResponse.json({ events: view(rows), welcome: view(fresh) }, { headers: { "Cache-Control": "no-store" } });
}

const schema = z.discriminatedUnion("action", [z.object({ action: z.literal("seen") }), z.object({ action: z.literal("claim"), code: z.string().max(40) })]);

/**
 * "seen": the welcome was shown. "claim": "Punya kode?" links a sign-up by its code, but only one made
 * with this account's own verified email; anything else gets the same not_found, and the organiser can
 * move a sign-up made with another address to this one.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const body = await readSizedBody(req, schema, 500);
  if ("error" in body) return body.error;
  if (body.data.action === "seen") {
    await markPreregWelcomed(db, user.id);
    return NextResponse.json({ ok: true });
  }
  if (!(await allow(`prereg-claim:${user.id}`, 10, 3_600_000))) return fail(429, "too_many_requests");
  if (!user.emailVerifiedAt) return fail(409, "verify_first");
  const code = normalizePreregCode(body.data.code);
  const row = code ? await claimPrereg(db, user, code) : null;
  if (!row) return fail(404, "not_found");
  await markPreregWelcomed(db, user.id);
  return NextResponse.json({ events: view(await myPreregistrations(db, user.id)) });
}
