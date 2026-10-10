import { deletePushSubscription, savePushSubscription } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { pushPublicKey } from "@/lib/push";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Only the browsers' own push services: an endpoint elsewhere would make the server call out to it.
const PUSH_HOSTS = /^https:\/\/([\w-]+\.)*(googleapis\.com|mozilla\.com|mozaws\.net|windows\.com|notify\.windows\.com|push\.apple\.com)(\/|$)/;
const subscription = z.object({
  endpoint: z.string().url().max(1000).regex(PUSH_HOSTS),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});
const unsubscribe = z.object({ endpoint: z.string().max(1000) });

/** The public key browsers need to subscribe, or null when push is not set up. */
export async function GET() {
  return NextResponse.json({ publicKey: pushPublicKey() }, { headers: { "Cache-Control": "no-store" } });
}

/** This device wants notifications outside the app for the signed-in account. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!pushPublicKey()) return fail(503, "push_off");
  if (!(await allow(`push:${user.id}`, 20, 3_600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, subscription);
  if ("error" in body) return body.error;
  await savePushSubscription(db, { userId: user.id, endpoint: body.data.endpoint, p256dh: body.data.keys.p256dh, auth: body.data.keys.auth });
  return NextResponse.json({ ok: true });
}

/** This device doesn't want them any more. */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const body = await readBody(req, unsubscribe);
  if ("error" in body) return body.error;
  await deletePushSubscription(db, { userId: user.id, endpoint: body.data.endpoint });
  return NextResponse.json({ ok: true });
}
