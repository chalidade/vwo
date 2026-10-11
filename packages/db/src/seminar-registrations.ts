// Seekers' seminar registrations: one private fair_state document per session,
// "semreg:<seminar id>" = { users: { "<user id>": <registered at, epoch ms> } }. The public setup read
// skips these keys (see fair-state.ts), so only counts and a seeker's own registrations leave the
// server, and the full list only to the organiser.
import { type SeminarSlot, SEMINAR_REG_MAX, registerBlock, registrantsOf } from "@vwo/shared";
import { eq, inArray, like, sql } from "drizzle-orm";
import type { Db } from "./client";
import { SEMINAR_REG_PREFIX } from "./fair-state";
import { fairState } from "./jobfair-schema";
import { users } from "./schema";

const keyOf = (seminarId: string) => `${SEMINAR_REG_PREFIX}${seminarId}`;

export type SeminarRegResult = { ok: true; registered: boolean; count: number } | { ok: false; error: "unscheduled" | "ended" | "full"; count: number };

/**
 * Register `userId` for the session, or cancel. Under a lock per session, so two seekers taking the
 * last seat take turns: the second finds it full. Registering twice, or cancelling when not
 * registered, changes nothing. Cancelling is always allowed.
 */
export function setSeminarRegistration(
  db: Db,
  input: { slot: Pick<SeminarSlot, "id" | "startAt" | "minutes" | "capacity">; userId: string; register: boolean; now: number },
): Promise<SeminarRegResult> {
  const key = keyOf(input.slot.id);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"fair:" + key}))`);
    const [row] = await tx.select({ data: fairState.data }).from(fairState).where(eq(fairState.key, key));
    const list = registrantsOf(row?.data);
    const count = Object.keys(list).length;
    const was = input.userId in list;
    if (was === input.register) return { ok: true as const, registered: was, count };
    if (input.register) {
      const block = registerBlock(input.slot, count, input.now);
      if (block) return { ok: false as const, error: block, count };
      list[input.userId] = input.now;
    } else delete list[input.userId];
    const data = { users: list };
    await tx
      .insert(fairState)
      .values({ key, data, updatedBy: input.userId })
      .onConflictDoUpdate({ target: fairState.key, set: { data, updatedBy: input.userId, updatedAt: sql`now()` } });
    return { ok: true as const, registered: input.register, count: Object.keys(list).length };
  });
}

/** How many registered for each session: { "<seminar id>": 12 }. */
export async function seminarRegCounts(db: Db): Promise<Record<string, number>> {
  const rows = await db
    .select({ key: fairState.key, n: sql<number>`(select count(*) from jsonb_object_keys(coalesce(${fairState.data}->'users', '{}'::jsonb)))::int` })
    .from(fairState)
    .where(like(fairState.key, `${SEMINAR_REG_PREFIX}%`));
  return Object.fromEntries(rows.map((r) => [r.key.slice(SEMINAR_REG_PREFIX.length), Number(r.n)]));
}

/** The sessions this account registered for. */
export async function mySeminarRegs(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ key: fairState.key })
    .from(fairState)
    .where(sql`${fairState.key} like ${SEMINAR_REG_PREFIX + "%"} and ${fairState.data}->'users'->${userId}::text is not null`);
  return rows.map((r) => r.key.slice(SEMINAR_REG_PREFIX.length));
}

/** Who registered for these sessions: { "<seminar id>": ["<user id>", ...] }, for reminders. */
export async function seminarRegistrantIds(db: Db, seminarIds: string[]): Promise<Record<string, string[]>> {
  if (!seminarIds.length) return {};
  const rows = await db
    .select({ key: fairState.key, data: fairState.data })
    .from(fairState)
    .where(inArray(fairState.key, seminarIds.map(keyOf)));
  return Object.fromEntries(rows.map((r) => [r.key.slice(SEMINAR_REG_PREFIX.length), Object.keys(registrantsOf(r.data))]));
}

/** The organiser's list for one session: name, email and when each registered, in that order. */
export async function seminarRegistrants(db: Db, seminarId: string) {
  const [row] = await db
    .select({ data: fairState.data })
    .from(fairState)
    .where(eq(fairState.key, keyOf(seminarId)));
  const list = registrantsOf(row?.data);
  const ids = Object.keys(list).slice(0, SEMINAR_REG_MAX);
  if (!ids.length) return [];
  const people = await db.select({ id: users.id, email: users.email, name: users.displayName }).from(users).where(inArray(users.id, ids));
  return people.map((p) => ({ name: p.name, email: p.email, at: list[p.id]! })).sort((a, b) => a.at - b.at);
}
