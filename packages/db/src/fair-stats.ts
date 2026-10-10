// Reach counters and the live feed of the live game. Counters are kept per account and day with a
// cap, so one account replaying requests moves a number by a few at most.
import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import { fairEvents, fairStats } from "./jobfair-schema";

export type StatWhat = "view" | "click" | "sold";
export interface StatHit {
  key: string;
  what: StatWhat;
  coins?: number;
}
export interface StatTotal {
  views: number;
  clicks: number;
  sold: number;
  coins: number;
}

/** How often one account counts per key, action and day. */
const CAP: Record<StatWhat, number> = { view: 30, click: 30, sold: 10 };

/** Count what one account did today. */
export async function addStats(db: Db, userId: string, day: string, hits: StatHit[]) {
  for (const h of hits) {
    const coins = Math.max(0, Math.min(500, Math.round(h.coins ?? 0)));
    await db
      .insert(fairStats)
      .values({ key: h.key, what: h.what, userId, day, n: 1, coins })
      .onConflictDoUpdate({
        target: [fairStats.key, fairStats.what, fairStats.userId, fairStats.day],
        set: {
          n: sql`least(${fairStats.n} + 1, ${CAP[h.what]})`,
          coins: sql`case when ${fairStats.n} < ${CAP[h.what]} then ${fairStats.coins} + ${coins} else ${fairStats.coins} end`,
          updatedAt: sql`now()`,
        },
      });
  }
}

/** Totals per key, optionally only keys starting with one of the prefixes. */
export async function statTotals(db: Db, prefixes?: string[]): Promise<Record<string, StatTotal>> {
  const where = prefixes?.length ? sql.join(prefixes.map((p) => sql`${fairStats.key} like ${p.replace(/[\\%_]/g, "\\$&") + "%"}`), sql` or `) : undefined;
  const rows = await db
    .select({ key: fairStats.key, what: fairStats.what, n: sql<number>`sum(${fairStats.n})::int`, coins: sql<number>`sum(${fairStats.coins})::int` })
    .from(fairStats)
    .where(where)
    .groupBy(fairStats.key, fairStats.what);
  const out: Record<string, StatTotal> = {};
  for (const r of rows) {
    const t = (out[r.key] ??= { views: 0, clicks: 0, sold: 0, coins: 0 });
    if (r.what === "view") t.views += r.n;
    else if (r.what === "click") t.clicks += r.n;
    else {
      t.sold += r.n;
      t.coins += r.coins;
    }
  }
  return out;
}

/**
 * Hand out one of a booth's merchandise: once per account, while stock lasts. Under a lock, so the
 * last one can't go to two people at once.
 */
export async function claimMerch(db: Db, input: { userId: string; boothKey: string; stock: number; day: string }): Promise<"ok" | "claimed" | "gone"> {
  const key = `acc:${input.boothKey}:giveaway`;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"merch:" + input.boothKey}))`);
    const [mine] = await tx.select({ n: fairStats.n }).from(fairStats).where(and(eq(fairStats.key, key), eq(fairStats.what, "sold"), eq(fairStats.userId, input.userId))).limit(1);
    if (mine) return "claimed";
    const [all] = await tx.select({ n: sql<number>`coalesce(sum(${fairStats.n}), 0)::int` }).from(fairStats).where(and(eq(fairStats.key, key), eq(fairStats.what, "sold")));
    if ((all?.n ?? 0) >= input.stock) return "gone";
    await tx.insert(fairStats).values({ key, what: "sold", userId: input.userId, day: input.day, n: 1 });
    return "ok";
  });
}

export type FairEventRow = { type: string; name: string; company?: string | null; jobTitle?: string | null };

/** Add to the live feed; only the newest thousand are kept. */
export async function addEvents(db: Db, userId: string, events: FairEventRow[]) {
  if (!events.length) return;
  await db.insert(fairEvents).values(events.map((e) => ({ userId, type: e.type, name: e.name, company: e.company ?? null, jobTitle: e.jobTitle ?? null })));
  if (Math.random() < 0.05) {
    await db.execute(sql`delete from fair_events where created_at < (select created_at from fair_events order by created_at desc offset 1000 limit 1)`);
  }
}

export async function recentEvents(db: Db, limit = 60) {
  const rows = await db.select().from(fairEvents).orderBy(desc(fairEvents.createdAt)).limit(limit);
  return rows.map((r) => ({ at: r.createdAt.getTime(), type: r.type, name: r.name, company: r.company ?? undefined, jobTitle: r.jobTitle ?? undefined }));
}
