import { AlreadyOfferedError, addSeekerOffer, myFairApplications, openSeekers, seekerProfiles, updateFairApplicationShared } from "@vwo/db";
import { type TalentOffer, offerMessage, openJobs, talentOfferSchema } from "@vwo/shared";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { boothNow } from "@/lib/booths";
import { db } from "@/lib/db";
import { canManageBooth } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { poolBooths, seekerHandle } from "@/lib/pool";
import { pushTo } from "@/lib/push";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const BOOTH = /^[\w-]{1,80}$/;

/**
 * "Tawarkan lowongan": invite someone from the talent pool, or an opted-in seeker from "Kandidat
 * cocok", to apply to one of the booth's open vacancies. Only people who applied to the company and
 * didn't switch contact off, or who switched it on for every company, can be reached. A past
 * applicant to this booth also gets it as a chat message on their last application here.
 */
export async function POST(req: Request, { params }: { params: Promise<{ booth: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const { booth } = await params;
  if (!BOOTH.test(booth)) return fail(404, "not_found");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await canManageBooth(user, booth))) return fail(403, "not_allowed");
  if (!(await allow(`offer:${user.id}`, 40, 3600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, talentOfferSchema);
  if ("error" in body) return body.error;
  const { seeker, jobId, note } = body.data;

  const b = await boothNow(booth);
  const job = b && openJobs(b).find((j) => j.id === jobId);
  if (!b || !job) return fail(404, "job_not_found");

  // Who the offer is for, and whether they may be reached.
  let userId: string;
  let lastHere: string | undefined;
  if (seeker.startsWith("h_")) {
    const found = (await openSeekers(db)).find((s) => seekerHandle(booth, s.userId) === seeker);
    if (!found) return fail(404, "not_found");
    userId = found.userId;
  } else {
    userId = seeker;
    const mine = new Set(await poolBooths(user.id, booth));
    const apps = (await myFairApplications(db, userId)).filter((a) => mine.has(a.boothKey));
    if (!apps.length) return fail(404, "not_found");
    const profile = (await seekerProfiles(db, [userId])).get(userId);
    if (profile?.contactable === false) return fail(403, "not_contactable");
    if (apps.some((a) => a.boothKey === booth && a.jobKey === jobId)) return fail(409, "already_applied");
    lastHere = apps.find((a) => a.boothKey === booth)?.id;
  }
  if (userId === user.id) return fail(400, "invalid_input");

  const offer: TalentOffer = { id: randomUUID(), boothId: booth, jobId, company: b.company, jobTitle: job.title, note: note || undefined, at: Date.now() };
  try {
    await addSeekerOffer(db, userId, offer, user.id);
  } catch (e) {
    if (e instanceof AlreadyOfferedError) return fail(409, "already_offered");
    throw e;
  }
  if (lastHere)
    await updateFairApplicationShared(db, {
      id: lastHere,
      as: "company",
      userId: user.id,
      incoming: { messages: [{ at: Date.now(), from: "company", text: offerMessage(offer) }] },
    });
  pushTo([userId], { title: `💼 ${b.company}`, body: `Kamu ditawari melamar ${job.title}`, url: "/play/#/jobfair", tag: `offer-${offer.id}` });
  return NextResponse.json({ ok: true, chat: !!lastHere }, { status: 201 });
}
