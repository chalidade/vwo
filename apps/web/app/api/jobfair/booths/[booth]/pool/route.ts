import { filterPool, pageOf, poolFacets, poolFilterSchema } from "@vwo/shared";
import { NextResponse } from "next/server";
import { canManageBooth } from "@/lib/fair";
import { fail } from "@/lib/http";
import { loadPool, poolBooths } from "@/lib/pool";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const BOOTH = /^[\w-]{1,80}$/;

/**
 * The booth's talent pool: everyone who ever applied to it (or to the account's other booths), one
 * row per person, filtered and a page at a time. Only that company's accounts and event admins see it.
 */
export async function GET(req: Request, { params }: { params: Promise<{ booth: string }> }) {
  const { booth } = await params;
  if (!BOOTH.test(booth)) return fail(404, "not_found");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await canManageBooth(user, booth))) return fail(403, "not_allowed");
  if (!(await allow(`pool:${user.id}`, 120, 600_000))) return fail(429, "too_many_requests");
  const q = new URL(req.url).searchParams;
  const filter = poolFilterSchema.safeParse({
    q: q.get("q") || undefined,
    skill: q.get("skill") || undefined,
    city: q.get("city") || undefined,
    education: q.get("education") || undefined,
    status: q.get("status") || undefined,
  });
  if (!filter.success) return fail(400, "invalid_input");
  const page = Math.min(1000, Number(q.get("page")) || 0);
  const all = await loadPool(await poolBooths(user.id, booth));
  const { items, ...rest } = pageOf(filterPool(all, filter.data), page);
  return NextResponse.json({ members: items, ...rest, facets: poolFacets(all) }, { headers: { "Cache-Control": "no-store" } });
}
