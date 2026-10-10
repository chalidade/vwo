import { applicationBooth, boothMemberIds, fairApplicationById, updateFairApplicationShared } from "@vwo/db";
import { type ApplicationShared, applicationSharedPutSchema, mergeShared, sharedNews } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canManageBooth } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { pushTo } from "@/lib/push";
import { currentUser } from "@/lib/session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chat, interview, rating and call log on one application, from the applicant or the company. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const { id } = await params;
  if (!UUID.test(id)) return fail(404, "not_found");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`shared:${user.id}`, 120, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, applicationSharedPutSchema);
  if ("error" in body) return body.error;
  if (body.data.as === "company") {
    const booth = await applicationBooth(db, id);
    if (!booth) return fail(404, "not_found");
    if (!(await canManageBooth(user, booth))) return fail(403, "not_allowed");
  }
  const before = await fairApplicationById(db, id);
  const ok = await updateFairApplicationShared(db, { id, as: body.data.as, userId: user.id, incoming: body.data.shared });
  if (!ok) return fail(404, "not_found");
  // Tell the other side on their phone, even with the app closed.
  if (before) {
    const stored = before.shared as ApplicationShared;
    const news = sharedNews(stored, mergeShared(stored, body.data.shared, body.data.as), body.data.as);
    const d = before.data as { company?: string; name?: string; jobTitle?: string };
    if (news && body.data.as === "company")
      pushTo([before.userId], { title: `${news.kind === "chat" ? "💬" : news.kind === "interview" ? "📅" : news.kind === "visit" ? "🏢" : news.kind === "call" ? "📞" : "⭐"} ${d.company ?? "HR"}`, body: news.text, url: "/play/#/jobfair", tag: `app-${id}` });
    else if (news)
      pushTo(await boothMemberIds(db, before.boothKey), { title: `${news.kind === "chat" ? "💬" : "✅"} ${d.name ?? "Pelamar"} · ${d.jobTitle ?? ""}`, body: news.text, url: `/play/#/jobfair/company/${before.boothKey}`, tag: `app-${id}` });
  }
  return NextResponse.json({ ok: true });
}
