// Post-event reports per booth: built from the live tables, and frozen into fair_booth_reports when
// the organiser closes an event so the next event can be compared with it. A report covers what
// happened since the booth's last frozen report.
import { type BoothReport, composeBoothReport, type ReportApplication } from "@vwo/shared";
import { and, desc, eq, gte, inArray, isNotNull, like, sql } from "drizzle-orm";
import type { Db } from "./client";
import { companyRegistrations, fairApplications, fairBoothMembers, fairBoothReports, fairPayments, fairPlayers, fairReviews, fairStats } from "./jobfair-schema";

const esc = (s: string) => s.replace(/[\\%_]/g, "\\$&");
/** What a payment was worth in rupiah: coin payments keep the rupiah price beside the coins. */
const rupiahOf = sql<number>`coalesce(sum(case when ${fairPayments.provider} = 'koin' then coalesce((${fairPayments.meta} ->> 'rupiah')::bigint, 0) else ${fairPayments.amount} end), 0)::bigint`;

/** When the booth's last report was frozen; its next report starts there. */
export async function lastReportAt(db: Db, boothKey: string) {
  const [row] = await db
    .select({ at: fairBoothReports.createdAt })
    .from(fairBoothReports)
    .where(eq(fairBoothReports.boothKey, boothKey))
    .orderBy(desc(fairBoothReports.createdAt))
    .limit(1);
  return row?.at ?? null;
}

/**
 * The booth's report as it stands now. `since` defaults to the booth's last frozen report, so a
 * second event only counts its own visits, applicants and payments.
 */
export async function buildBoothReport(db: Db, boothKey: string, opts: { since?: Date | null; now?: Date } = {}): Promise<BoothReport> {
  const since = opts.since === undefined ? await lastReportAt(db, boothKey) : opts.since;
  const now = opts.now ?? new Date();

  // Reach. Counters are per account and day, so a day split by the freeze counts on both sides.
  const statSince = since ? and(gte(fairStats.day, since.toISOString().slice(0, 10)), gte(fairStats.updatedAt, since)) : undefined;
  const stat = async (key: string, what: "view" | "click" | "sold") => {
    const [r] = await db
      .select({ n: sql<number>`coalesce(sum(${fairStats.n}), 0)::int`, people: sql<number>`count(distinct ${fairStats.userId})::int` })
      .from(fairStats)
      .where(and(eq(fairStats.key, key), eq(fairStats.what, what), statSince));
    return r ?? { n: 0, people: 0 };
  };
  const visit = await stat(`visit:${boothKey}`, "view");
  const promoViews = (await stat(`promo:co-${boothKey}`, "view")).n;
  const promoClicks = (await stat(`promo:co-${boothKey}`, "click")).n;
  const merch = (await stat(`acc:${boothKey}:giveaway`, "sold")).n;

  // Applications, with the campus (and anything missing) from the applicant's game profile.
  const profile = (field: string) => sql<string | null>`${fairPlayers.data} -> 'profile' ->> ${field}`;
  const rows = await db
    .select({
      userId: fairApplications.userId,
      jobKey: fairApplications.jobKey,
      status: fairApplications.status,
      data: fairApplications.data,
      campus: profile("campus"),
      city: profile("city"),
      education: profile("education"),
      headline: profile("headline"),
    })
    .from(fairApplications)
    .leftJoin(fairPlayers, eq(fairPlayers.userId, fairApplications.userId))
    .where(and(eq(fairApplications.boothKey, boothKey), since ? gte(fairApplications.createdAt, since) : undefined))
    .orderBy(fairApplications.createdAt)
    .limit(5000);
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 300) : undefined);
  const applications: ReportApplication[] = rows.map((r) => {
    const d = (r.data ?? {}) as Record<string, unknown>;
    return {
      userId: r.userId,
      jobKey: r.jobKey,
      jobTitle: str(d.jobTitle),
      status: r.status,
      city: str(d.city) || str(r.city),
      education: str(d.education) || str(r.education),
      campus: str(d.campus) || str(r.campus),
      headline: str(d.headline) || str(r.headline),
      skills: str(d.skills),
      verified: d.verified === true,
      psych: typeof d.psych === "number" ? d.psych : undefined,
    };
  });

  const [rating] = await db
    .select({ count: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(${fairReviews.stars}), 0)::int` })
    .from(fairReviews)
    .where(and(eq(fairReviews.boothKey, boothKey), since ? gte(fairReviews.updatedAt, since) : undefined));

  // Spend: the registration price, the booth's paid bills, and food court stands its team rented.
  const [reg] = await db
    .select({ total: sql<number>`coalesce(sum(${companyRegistrations.price}), 0)::bigint` })
    .from(companyRegistrations)
    .where(
      and(
        eq(companyRegistrations.boothKey, boothKey),
        inArray(companyRegistrations.status, ["paid", "verified"]),
        isNotNull(companyRegistrations.paidAt),
        since ? gte(companyRegistrations.paidAt, since) : undefined,
      ),
    );
  const paidSince = and(eq(fairPayments.status, "paid"), since ? gte(fairPayments.paidAt, since) : undefined);
  const [inv] = await db
    .select({ total: rupiahOf })
    .from(fairPayments)
    .where(and(eq(fairPayments.kind, "invoice"), like(fairPayments.ref, `${esc(boothKey)}:%`), paidSince));
  const team = db.select({ userId: fairBoothMembers.userId }).from(fairBoothMembers).where(eq(fairBoothMembers.boothKey, boothKey));
  const [stalls] = await db
    .select({ total: rupiahOf })
    .from(fairPayments)
    .where(and(eq(fairPayments.kind, "stall"), inArray(fairPayments.userId, team), paidSince));

  return composeBoothReport({
    boothKey,
    since: since?.getTime() ?? null,
    until: now.getTime(),
    visits: visit.n,
    visitors: visit.people,
    promoViews,
    promoClicks,
    merch,
    rating: rating ?? null,
    applications,
    spend: { registration: Number(reg?.total ?? 0), invoices: Number(inv?.total ?? 0), stalls: Number(stalls?.total ?? 0) },
  });
}

/** Booths the database knows: with a team, applicants, or a registration. */
export async function reportBoothKeys(db: Db) {
  const rows = await db.execute<{ booth_key: string }>(
    sql`select booth_key from fair_booth_members union select booth_key from fair_applications union select booth_key from company_registrations where booth_key is not null`,
  );
  return [...rows].map((r) => r.booth_key);
}

export class ReportNameTakenError extends Error {
  constructor() {
    super("event name already used");
  }
}

/**
 * Close an event: every booth's report is frozen under the event's name. Under a lock and refused
 * when the name was used before, so a double click or two organisers at once save it only once.
 */
export async function freezeBoothReports(db: Db, input: { eventName: string; boothKeys: string[]; by: string; now?: Date }) {
  const now = input.now ?? new Date();
  const keys = [...new Set(input.boothKeys)].slice(0, 1000);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('fair_booth_reports'))`);
    const [taken] = await tx
      .select({ id: fairBoothReports.id })
      .from(fairBoothReports)
      .where(sql`lower(${fairBoothReports.eventName}) = lower(${input.eventName})`)
      .limit(1);
    if (taken) throw new ReportNameTakenError();
    const rows = [];
    for (const boothKey of keys) {
      // Built inside the lock, so a report never overlaps the one frozen just before it.
      const data = await buildBoothReport(tx as unknown as Db, boothKey, { now });
      rows.push({ boothKey, eventName: input.eventName, data, createdBy: input.by, createdAt: now });
    }
    if (rows.length) await tx.insert(fairBoothReports).values(rows);
    return rows.length;
  });
}

/** A booth's frozen reports, newest first (without their contents). */
export function boothReportList(db: Db, boothKey: string) {
  return db
    .select({ id: fairBoothReports.id, eventName: fairBoothReports.eventName, createdAt: fairBoothReports.createdAt })
    .from(fairBoothReports)
    .where(eq(fairBoothReports.boothKey, boothKey))
    .orderBy(desc(fairBoothReports.createdAt))
    .limit(50);
}

/** One frozen report, only when it belongs to that booth. */
export async function boothReportById(db: Db, boothKey: string, id: string) {
  const [row] = await db
    .select()
    .from(fairBoothReports)
    .where(and(eq(fairBoothReports.id, id), eq(fairBoothReports.boothKey, boothKey)));
  return row ? { id: row.id, eventName: row.eventName, createdAt: row.createdAt, report: row.data as BoothReport } : null;
}

/** Events the organiser closed, newest first, with how many booths each saved. */
export function closedEvents(db: Db) {
  return db
    .select({ eventName: fairBoothReports.eventName, booths: sql<number>`count(*)::int`, at: sql<Date>`max(${fairBoothReports.createdAt})`.mapWith(fairBoothReports.createdAt) })
    .from(fairBoothReports)
    .groupBy(fairBoothReports.eventName)
    .orderBy(desc(sql`max(${fairBoothReports.createdAt})`))
    .limit(50);
}
