import { readFairState, readFairStateKey, readPrices, writeFairState } from "@vwo/db";
import { cleanPrices } from "@vwo/shared";
import { NextResponse } from "next/server";
import { guardCompanyDoc } from "@/lib/company-doc";
import { db } from "@/lib/db";
import { canManageBooth, isFairAdmin } from "@/lib/fair";
import { fail, sameOrigin } from "@/lib/http";
import { publicCache, stateCdnSec, stateInlineMax, stateSwrSec } from "@/lib/limits";
import { allow } from "@/lib/ratelimit";
import { kickSeminarPushes } from "@/lib/seminars";
import { buildState, etagOf, extractMedia, matches, MEDIA_PATH, rememberMedia, restoreMedia } from "@/lib/state-view";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const KEY = /^(org|company:[\w-]{1,80})$/;
/** Logos and booth media are small inline images; a whole setup stays well under this. */
const MAX_BYTES = 2_000_000;

type Doc = Record<string, unknown>;

/**
 * The event as the organiser and the companies set it up, for every visitor's game: the public view,
 * the same for everyone, so it never looks at the session and the CDN can keep it (STATE_CDN_SEC).
 * Event admins' and booth accounts' own parts (PINs, bookings, invoices) come from ./mine.
 * The price list rides along (it used to be a poll of its own). Big inline pictures are served by hash from ./media. `?fresh=1` skips the CDN, right after a change.
 */
export async function GET(req: Request) {
  const [rows, prices] = await Promise.all([readFairState(db), readPrices(db)]);
  // Seminar pushes ("15 minutes to go", "starting") ride on reads of the setup; see lib/seminars.ts.
  const org = rows.find((r) => r.key === "org");
  if (org) kickSeminarPushes(org.data);
  const { doc, media } = extractMedia({ ...buildState(rows, { admin: false, mine: new Set() }), prices: cleanPrices(prices) }, stateInlineMax());
  rememberMedia(media);
  const body = JSON.stringify(doc);
  const etag = etagOf(body);
  const fresh = new URL(req.url).searchParams.has("fresh");
  const headers = { "Cache-Control": fresh ? "no-store" : publicCache(stateCdnSec(), stateSwrSec()), ETag: etag };
  if (matches(req, etag)) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(body, { headers: { ...headers, "Content-Type": "application/json" } });
}

/** Save the organiser's setup (event admins) or one company's booth (its accounts, or admins). */
export async function PUT(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`state:${user.id}`, 120, 600_000))) return fail(429, "too_many_requests");
  const text = await req.text();
  if (text.length > MAX_BYTES) return fail(413, "too_large");
  let body: { key?: unknown; data?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return fail(400, "invalid_input");
  }
  if (typeof body.key !== "string" || !KEY.test(body.key) || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) return fail(400, "invalid_input");
  const admin = isFairAdmin(user);
  const booth = body.key.startsWith("company:") ? body.key.slice("company:".length) : null;
  if (!admin && !(booth && (await canManageBooth(user, booth)))) return fail(403, "not_allowed");
  // A company's own save can't mark bills paid or unlock products; only confirmed payments do.
  let data = admin || !booth ? body.data : await guardCompanyDoc(booth, body.data as Parameters<typeof guardCompanyDoc>[1]);
  // Pictures that came as the public setup's URLs go back in as the pictures they stand for.
  if (text.includes(MEDIA_PATH)) data = restoreMedia(data, (await readFairStateKey(db, body.key))?.data);
  if (body.key === "org") {
    // Announcements are changed only through their own API: an older copy of the setup pushed from
    // some browser must not bring one back. The setup keeps whatever it had stored before.
    const { announcement: _a, announcements: _b, ...rest } = data as Doc;
    const stored = (await readFairStateKey(db, "org"))?.data as Doc | undefined;
    data = stored?.announcement ? { ...rest, announcement: stored.announcement } : rest;
  }
  await writeFairState(db, { key: body.key, data, userId: user.id });
  return NextResponse.json({ ok: true });
}
