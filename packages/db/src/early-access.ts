// Testers the organiser lets in before launch.
import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import { earlyAccess, fairBoothMembers } from "./jobfair-schema";
import { users } from "./schema";

export type EarlyRole = "seeker" | "company";

const norm = (email: string) => email.trim().toLowerCase();

export function earlyAccessList(db: Db) {
  return db.select().from(earlyAccess).orderBy(asc(earlyAccess.createdAt));
}

export async function earlyAccessFor(db: Db, email: string) {
  const [row] = await db.select().from(earlyAccess).where(eq(earlyAccess.email, norm(email)));
  return row ?? null;
}

/** Take the tester's account (if it exists yet) off the trial booth it was given. */
async function dropTrialBooth(db: Db, email: string, boothKey: string | null) {
  if (!boothKey) return;
  await db
    .delete(fairBoothMembers)
    .where(and(eq(fairBoothMembers.boothKey, boothKey), sql`${fairBoothMembers.userId} in (select ${users.id} from ${users} where lower(${users.email}) = ${email})`));
}

/** Add a tester, or change their role, booth or note. A booth they no longer test is taken back. */
export async function grantEarlyAccess(db: Db, input: { email: string; role: EarlyRole; boothKey?: string | null; note?: string | null; addedBy: string }) {
  const before = await earlyAccessFor(db, input.email);
  const row = { email: norm(input.email), role: input.role, boothKey: input.role === "company" ? (input.boothKey ?? null) : null, note: input.note ?? null, addedBy: input.addedBy };
  const [saved] = await db
    .insert(earlyAccess)
    .values(row)
    .onConflictDoUpdate({ target: earlyAccess.email, set: { role: row.role, boothKey: row.boothKey, note: row.note } })
    .returning();
  if (before?.boothKey && before.boothKey !== saved!.boothKey) await dropTrialBooth(db, saved!.email, before.boothKey);
  return saved!;
}

/** Take a tester off the list; returns the row that was removed. */
export async function revokeEarlyAccess(db: Db, email: string) {
  const [row] = await db.delete(earlyAccess).where(eq(earlyAccess.email, norm(email))).returning();
  if (row) await dropTrialBooth(db, row.email, row.boothKey);
  return row ?? null;
}
