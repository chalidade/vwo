import { openSeekers } from "@vwo/db";
import { outsiderMember, rankCandidates } from "@vwo/shared";
import { NextResponse } from "next/server";
import { boothNow } from "@/lib/booths";
import { db } from "@/lib/db";
import { canManageBooth } from "@/lib/fair";
import { fail } from "@/lib/http";
import { loadPool, poolBooths, seekerHandle } from "@/lib/pool";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const BOOTH = /^[\w-]{1,80}$/;
const KEY = /^[\w-]{1,80}$/;

/**
 * "Kandidat cocok" for one vacancy: the company's past applicants and the seekers who let any company
 * contact them, ranked against the vacancy as the booth stands now. Seekers who never applied to the
 * company come without name, photo or contact details until they apply.
 */
export async function GET(req: Request, { params }: { params: Promise<{ booth: string }> }) {
  const { booth } = await params;
  const jobId = new URL(req.url).searchParams.get("job") ?? "";
  if (!BOOTH.test(booth) || !KEY.test(jobId)) return fail(404, "not_found");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await canManageBooth(user, booth))) return fail(403, "not_allowed");
  if (!(await allow(`matches:${user.id}`, 60, 600_000))) return fail(429, "too_many_requests");
  const b = await boothNow(booth);
  const job = b?.jobs.find((j) => j.id === jobId);
  if (!b || !job) return fail(404, "not_found");
  const pool = await loadPool(await poolBooths(user.id, booth));
  const known = new Set(pool.map((m) => m.seeker));
  const strangers = (await openSeekers(db)).filter((s) => !known.has(s.userId) && s.userId !== user.id).map((s) => outsiderMember(seekerHandle(booth, s.userId), s.profile, s.at));
  return NextResponse.json({ candidates: rankCandidates([...pool, ...strangers], b, job, 12) }, { headers: { "Cache-Control": "no-store" } });
}
