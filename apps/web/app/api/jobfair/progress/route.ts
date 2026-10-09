import { readFairPlayer, writeFairPlayer } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Coins, missions, vouchers, psikotes results, stamps, notifications, profile photo: well under this. */
const MAX_BYTES = 400_000;
const PARTS = new Set(["player", "stamps", "inbox", "profile", "character"]);

/** The signed-in account's game progress, for whichever device they open the job fair on. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const row = await readFairPlayer(db, user.id);
  return NextResponse.json(row ?? { data: null, rev: 0 }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Save it. Only ever read back by the same account, so the document is checked for shape and size,
 * not field by field. A save on top of an older revision gets 409 with what is stored now.
 */
export async function PUT(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`progress:${user.id}`, 240, 600_000))) return fail(429, "too_many_requests");
  const text = await req.text();
  if (text.length > MAX_BYTES) return fail(413, "too_large");
  let body: { rev?: unknown; data?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return fail(400, "invalid_input");
  }
  const { rev, data } = body;
  if (!Number.isInteger(rev) || (rev as number) < 0 || !data || typeof data !== "object" || Array.isArray(data)) return fail(400, "invalid_input");
  if (Object.keys(data).some((k) => !PARTS.has(k))) return fail(400, "invalid_input");
  const next = await writeFairPlayer(db, { userId: user.id, rev: rev as number, data });
  if (next !== null) return NextResponse.json({ rev: next });
  const now = await readFairPlayer(db, user.id);
  return NextResponse.json({ error: "conflict", ...(now ?? { data: null, rev: 0 }) }, { status: 409 });
}
