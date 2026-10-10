import { readFairStateKey, writeFairState } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { canManageBooth } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const BOOTH = /^[\w-]{1,80}$/;
/** Everything up to `all` is read, and the notifications in `ids` after it; deleted ones the same
 *  way with `cleared` and `hidden`. */
const schema = z.object({
  all: z.number().int().nonnegative(),
  ids: z.array(z.string().max(200)).max(300),
  cleared: z.number().int().nonnegative().optional(),
  hidden: z.array(z.string().max(200)).max(300).optional(),
});
type Read = z.infer<typeof schema>;

async function readMarks(booth: string): Promise<Read> {
  const row = await readFairStateKey(db, `inbox:${booth}`);
  const d = row?.data as Partial<Read> | undefined;
  return { all: d?.all ?? 0, ids: d?.ids ?? [], cleared: d?.cleared ?? 0, hidden: d?.hidden ?? [] };
}

async function allowed(booth: string) {
  if (!BOOTH.test(booth)) return fail(404, "not_found");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await canManageBooth(user, booth))) return fail(403, "not_allowed");
  return user;
}

/**
 * Which of a booth's notifications its team has read. The notifications themselves are worked out
 * from the booth's applications, so every device of the company sees the same list.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ booth: string }> }) {
  const { booth } = await params;
  const user = await allowed(booth);
  if (user instanceof Response) return user;
  return NextResponse.json({ read: await readMarks(booth) }, { headers: { "Cache-Control": "no-store" } });
}

/** Mark notifications read or deleted. Marks only grow: what another device marked stays marked. */
export async function PUT(req: Request, { params }: { params: Promise<{ booth: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const { booth } = await params;
  const user = await allowed(booth);
  if (user instanceof Response) return user;
  if (!(await allow(`inbox:${user.id}`, 120, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const have = await readMarks(booth);
  const all = Math.min(Math.max(have.all, body.data.all), Date.now() + 60_000);
  const cleared = Math.min(Math.max(have.cleared ?? 0, body.data.cleared ?? 0), Date.now() + 60_000);
  const read = {
    all,
    ids: [...new Set([...have.ids, ...body.data.ids])].slice(-300),
    cleared,
    hidden: [...new Set([...(have.hidden ?? []), ...(body.data.hidden ?? [])])].slice(-300),
  };
  await writeFairState(db, { key: `inbox:${booth}`, data: read, userId: user.id });
  return NextResponse.json({ read });
}
