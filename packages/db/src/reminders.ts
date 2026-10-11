// Who has something on their schedule in a time window, for the morning reminders: interviews and
// office visits from the live game's applications, and Aula items seekers asked to be reminded of.
import { inArray, or, sql } from "drizzle-orm";
import type { Db } from "./client";
import { fairApplications, fairPlayers } from "./jobfair-schema";
import { users } from "./schema";

/** The interview's or visit's time in `shared` is a number, between `from` and `to` (epoch ms). */
const atBetween = (key: "interview" | "visit", from: number, to: number) => {
  const at = sql`${fairApplications.shared}->${sql.raw(`'${key}'`)}`;
  return sql`(jsonb_typeof(${at}->'at') = 'number' and (${at}->>'at')::numeric between ${from}::numeric and ${to}::numeric)`;
};

/** Applications with an interview or office visit between `from` and `to` (epoch ms). */
export function applicationsScheduledBetween(db: Db, from: number, to: number) {
  return db
    .select({
      id: fairApplications.id,
      userId: fairApplications.userId,
      status: fairApplications.status,
      company: sql<string>`coalesce(${fairApplications.data}->>'company', '')`,
      jobTitle: sql<string>`coalesce(${fairApplications.data}->>'jobTitle', '')`,
      shared: fairApplications.shared,
    })
    .from(fairApplications)
    .where(or(atBetween("interview", from, to), atBetween("visit", from, to)));
}

/** Players whose saved progress asks for reminders on `day` ("2026-10-11"), with that list. */
export function playersRemindedOn(db: Db, day: string) {
  return db
    .select({ userId: fairPlayers.userId, remind: sql<unknown>`${fairPlayers.data}->'player'->'remind'` })
    .from(fairPlayers)
    .where(sql`${fairPlayers.data}->'player'->'remind'->${day}::text is not null`);
}

/** The accounts' own addresses and names, and whether the address was verified as theirs. */
export function reminderRecipients(db: Db, userIds: string[]) {
  if (!userIds.length) return Promise.resolve([]);
  return db
    .select({ id: users.id, email: users.email, name: users.displayName, verified: sql<boolean>`${users.emailVerifiedAt} is not null` })
    .from(users)
    .where(inArray(users.id, userIds));
}
