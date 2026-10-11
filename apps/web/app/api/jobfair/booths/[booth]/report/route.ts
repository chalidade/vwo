import { boothReportById, boothReportList, buildBoothReport, isBoothMember } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const BOOTH = /^[\w-]{1,80}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The booth's post-event report: the current event so far, its saved reports from earlier events,
 * and the latest of those to compare with. With `?id=` one saved report. Spend and applicants are
 * the company's own business, so only accounts that run this booth may read it.
 */
export async function GET(req: Request, { params }: { params: Promise<{ booth: string }> }) {
  const { booth } = await params;
  if (!BOOTH.test(booth)) return fail(404, "not_found");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await isBoothMember(db, user.id, booth))) return fail(403, "not_allowed");
  if (!(await allow(`report:${user.id}`, 60, 600_000))) return fail(429, "too_many_requests");
  const headers = { "Cache-Control": "no-store" };

  const id = new URL(req.url).searchParams.get("id");
  if (id !== null) {
    if (!UUID.test(id)) return fail(404, "not_found");
    const saved = await boothReportById(db, booth, id);
    if (!saved) return fail(404, "not_found");
    return NextResponse.json({ saved: { id: saved.id, eventName: saved.eventName, at: saved.createdAt.getTime(), report: saved.report } }, { headers });
  }

  const list = await boothReportList(db, booth);
  const report = await buildBoothReport(db, booth, { since: list[0]?.createdAt ?? null });
  const previous = list[0] ? await boothReportById(db, booth, list[0].id) : null;
  return NextResponse.json(
    {
      report,
      history: list.map((r) => ({ id: r.id, eventName: r.eventName, at: r.createdAt.getTime() })),
      previous: previous ? { id: previous.id, eventName: previous.eventName, at: previous.createdAt.getTime(), report: previous.report } : null,
    },
    { headers },
  );
}
