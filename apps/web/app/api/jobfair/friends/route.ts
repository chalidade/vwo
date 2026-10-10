import { addFriend, friendsOf, removeFriend, userIdByTag } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { pushTo } from "@/lib/push";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({ tag: z.string().regex(/^[0-9a-f]{12}$/) });

/** The signed-in player's friends and friend requests: public tag and display name only. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  return NextResponse.json({ tag: user.fairTag, friends: await friendsOf(db, user.id) }, { headers: { "Cache-Control": "private, no-store" } });
}

/** Ask someone met at the fair to be friends, or say yes to their request. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`friend:${user.id}`, 40, 3_600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const state = await addFriend(db, user.id, body.data.tag);
  if (state === "not_found") return fail(404, "not_found");
  if (state === "self") return fail(400, "self");
  const other = await userIdByTag(db, body.data.tag);
  if (other)
    pushTo([other.id], state === "friend" ? { title: "🤝 Teman baru", body: `${user.name} menerima pertemanan`, url: "/play/#/jobfair", tag: `friend-${user.fairTag}` } : { title: "⭐ Ajakan berteman", body: `${user.name} ingin berteman denganmu di job fair`, url: "/play/#/jobfair", tag: `friend-${user.fairTag}` });
  return NextResponse.json({ ok: true, state });
}

/** Unfriend, withdraw a request, or turn one down. */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  await removeFriend(db, user.id, body.data.tag);
  return NextResponse.json({ ok: true });
}
