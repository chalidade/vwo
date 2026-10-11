import { readFairStateKey, updateFairStateLocked } from "@vwo/db";
import { ANNOUNCE_KEY, ANNOUNCE_MAX, type AnnounceBoard, cleanBoard, hideAnnouncement, legacyBoard, postAnnouncement, removeAnnouncement, repostAnnouncement } from "@vwo/shared";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const ID = z.string().regex(/^[\w-]{1,40}$/);
const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("post"), text: z.string().trim().min(1).max(ANNOUNCE_MAX) }),
  z.object({ op: z.literal("hide") }),
  z.object({ op: z.literal("repost"), id: ID }),
  z.object({ op: z.literal("remove"), id: ID }),
]);

/**
 * Event admins send, take down, show again or delete an announcement. Each is one step on the
 * stored board, under a lock, so it never depends on what an organiser's browser last saw.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!isFairAdmin(user)) return fail(403, "not_allowed");
  if (!(await allow(`announce:${user.id}`, 60, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const b = body.data;
  // Before the first change the board is the announcement kept in the old event setup, if any.
  const legacy = legacyBoard((await readFairStateKey(db, "org"))?.data as Parameters<typeof legacyBoard>[0]);
  const now = Date.now();
  const id = `a${now.toString(36)}${randomUUID().slice(0, 6)}`;
  const board = await updateFairStateLocked<AnnounceBoard>(db, ANNOUNCE_KEY, user.id, (stored) => {
    const was = stored === null ? legacy : cleanBoard(stored);
    if (b.op === "post") return postAnnouncement(was, b.text, now, id);
    if (b.op === "hide") return hideAnnouncement(was);
    if (b.op === "repost") return repostAnnouncement(was, b.id, now, id);
    return removeAnnouncement(was, b.id);
  });
  return NextResponse.json({ board });
}
