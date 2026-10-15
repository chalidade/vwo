// Job seeker pre-registration per event: the organiser's events, each job seeker's sign-up with its
// code, and linking sign-ups to the account that signs in with the same Google email. Contact details
// leave this file only for event admins (the organiser hub) or for the person holding both the email
// and the code. The form and its mapping onto the profile are in @vwo/shared prereg.ts.
import { type PreregData, type PreregEventData, fillEmptyProfile, newPreregCode, preregDates, preregSlug, preregState, profileFromPrereg } from "@vwo/shared";
import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { Db } from "./client";
import { fairPlayers, preregEvents, preregRegistrations } from "./jobfair-schema";

export type PreregEventRow = typeof preregEvents.$inferSelect;
export type PreregRegistrationRow = typeof preregRegistrations.$inferSelect;

/** A unique index refused the write (drizzle wraps the driver's error). */
const uniqueClash = (e: unknown) => [e, (e as { cause?: unknown })?.cause].some((x) => (x as { code?: string })?.code === "23505");

const count = sql<number>`count(${preregRegistrations.id})::int`;

/** Every event with how many signed up, newest first: for the organiser hub. */
export async function listPreregEvents(db: Db) {
  return db
    .select({ event: preregEvents, count })
    .from(preregEvents)
    .leftJoin(preregRegistrations, eq(preregRegistrations.eventId, preregEvents.id))
    .groupBy(preregEvents.id)
    .orderBy(desc(preregEvents.createdAt));
}

/** One event and its sign-up count, by its public address. */
export async function preregEventBySlug(db: Db, slug: string) {
  const [row] = await db
    .select({ event: preregEvents, count })
    .from(preregEvents)
    .leftJoin(preregRegistrations, eq(preregRegistrations.eventId, preregEvents.id))
    .where(eq(preregEvents.slug, slug))
    .groupBy(preregEvents.id);
  return row ?? null;
}

export async function preregEventById(db: Db, id: string) {
  const [row] = await db.select().from(preregEvents).where(eq(preregEvents.id, id));
  return row ?? null;
}

/** Events taking sign-ups now, soonest first: for the landing page. */
export async function openPreregEvents(db: Db, now = Date.now()) {
  const rows = await db
    .select({ event: preregEvents, count })
    .from(preregEvents)
    .leftJoin(preregRegistrations, eq(preregRegistrations.eventId, preregEvents.id))
    .where(eq(preregEvents.open, true))
    .groupBy(preregEvents.id)
    .orderBy(asc(preregEvents.startDate), asc(preregEvents.createdAt));
  return rows.filter((r) => preregState(r.event, r.count, now) === "open");
}

function eventValues(input: PreregEventData) {
  return {
    name: input.name,
    location: input.location,
    about: input.about || null,
    banner: input.banner ?? null,
    capacity: input.capacity ?? null,
    open: input.open,
    deadline: input.deadline ? new Date(input.deadline) : null,
    ...preregDates(input.startDate, input.endDate),
  };
}

/** A new event; its address comes from the name (or the typed one) with -2, -3… when taken. */
export async function createPreregEvent(db: Db, input: PreregEventData, by: string | null) {
  const base = preregSlug(input.name, input.slug);
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? base : `${base.slice(0, 44)}-${n}`;
    const [row] = await db
      .insert(preregEvents)
      .values({ slug, ...eventValues(input), createdBy: by })
      .onConflictDoNothing({ target: preregEvents.slug })
      .returning();
    if (row) return row;
  }
  throw new Error("no free slug");
}

/** Change an event. The address changes only when a new one is typed and free. Null when gone or taken. */
export async function updatePreregEvent(db: Db, id: string, input: PreregEventData) {
  const values: Partial<typeof preregEvents.$inferInsert> = { ...eventValues(input), updatedAt: new Date() };
  if (input.slug) values.slug = preregSlug(input.name, input.slug);
  try {
    const [row] = await db.update(preregEvents).set(values).where(eq(preregEvents.id, id)).returning();
    return row ?? null;
  } catch (e) {
    if (uniqueClash(e)) return "slug_taken" as const;
    throw e;
  }
}

/** Remove an event that nobody signed up for yet; one with sign-ups is closed instead, never deleted here. */
export async function deletePreregEvent(db: Db, id: string) {
  const rows = await db
    .delete(preregEvents)
    .where(and(eq(preregEvents.id, id), sql`not exists (select 1 from ${preregRegistrations} where ${preregRegistrations.eventId} = ${preregEvents.id})`))
    .returning({ id: preregEvents.id });
  return rows.length > 0;
}

// ---------------------------------------------------------------- sign-ups

export type PreregSubmit =
  | { status: "created" | "updated"; code: string; registration: PreregRegistrationRow }
  /** This email signed up before and no matching code came with it: nothing changed. */
  | { status: "exists" }
  | { status: "closed" | "deadline" | "full" | "no_event" };

/**
 * Sign up for an event, or change one's sign-up. One per (event, email): sending the same email again
 * changes the data and keeps the code, but only with that code, so knowing someone's email is not
 * enough to overwrite (or read) what they sent. The event row is locked so the capacity holds when
 * many send at once.
 */
export async function submitPrereg(db: Db, input: { eventId: string; data: PreregData; code: string | null }, now = Date.now()): Promise<PreregSubmit> {
  return db.transaction(async (tx) => {
    const [event] = await tx.select().from(preregEvents).where(eq(preregEvents.id, input.eventId)).for("update");
    if (!event) return { status: "no_event" };
    const email = input.data.email.trim().toLowerCase();
    const [mine] = await tx
      .select()
      .from(preregRegistrations)
      .where(and(eq(preregRegistrations.eventId, event.id), eq(preregRegistrations.email, email)));
    if (mine) {
      if (!input.code || input.code !== mine.code) return { status: "exists" };
      // A change is allowed while the form is open or only full, never after it closed.
      const state = preregState(event, 0, now);
      if (state !== "open") return { status: state };
      const [row] = await tx
        .update(preregRegistrations)
        .set({ data: input.data, updatedAt: new Date(now) })
        .where(eq(preregRegistrations.id, mine.id))
        .returning();
      return { status: "updated", code: mine.code, registration: row! };
    }
    const [{ n } = { n: 0 }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(preregRegistrations)
      .where(eq(preregRegistrations.eventId, event.id));
    const state = preregState(event, n, now);
    if (state !== "open") return { status: state };
    // A clash of two random codes is all but impossible; try again if it ever happens.
    for (let i = 0; i < 5; i++) {
      const code = newPreregCode((k) => randomBytes(k));
      const [row] = await tx.insert(preregRegistrations).values({ eventId: event.id, email, code, data: input.data }).onConflictDoNothing().returning();
      if (row) return { status: "created", code, registration: row };
    }
    throw new Error("no free code");
  });
}

/** One's own sign-up, only when both the email and the code match it. Null otherwise, whichever was wrong. */
export async function findPrereg(db: Db, eventId: string, email: string, code: string) {
  const [row] = await db
    .select()
    .from(preregRegistrations)
    .where(and(eq(preregRegistrations.eventId, eventId), eq(preregRegistrations.email, email.trim().toLowerCase()), eq(preregRegistrations.code, code)));
  return row ?? null;
}

/** An event's sign-ups for its organiser, newest first, optionally matching a name, email, code, city or campus. */
export async function preregRegistrants(db: Db, eventId: string, q = "") {
  const term = q.trim().slice(0, 80);
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select()
    .from(preregRegistrations)
    .where(
      and(
        eq(preregRegistrations.eventId, eventId),
        term
          ? or(
              ilike(preregRegistrations.email, like),
              ilike(preregRegistrations.code, like),
              ilike(sql`${preregRegistrations.data} ->> 'fullName'`, like),
              ilike(sql`${preregRegistrations.data} ->> 'city'`, like),
              ilike(sql`${preregRegistrations.data} ->> 'institution'`, like),
            )
          : undefined,
      ),
    )
    .orderBy(desc(preregRegistrations.createdAt));
}

/**
 * The organiser moves a sign-up to another email (someone signed up with an address that isn't their
 * Google account). It is unlinked so the right account picks it up. Null when gone; "taken" when that
 * email already signed up for the event.
 */
export async function setPreregEmail(db: Db, eventId: string, id: string, email: string) {
  try {
    const [row] = await db
      .update(preregRegistrations)
      .set({
        email: email.trim().toLowerCase(),
        data: sql`jsonb_set(${preregRegistrations.data}, '{email}', to_jsonb(${email.trim().toLowerCase()}::text))`,
        userId: null,
        linkedAt: null,
        welcomedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(preregRegistrations.id, id), eq(preregRegistrations.eventId, eventId)))
      .returning();
    return row ?? null;
  } catch (e) {
    if (uniqueClash(e)) return "taken" as const;
    throw e;
  }
}

export async function deletePrereg(db: Db, eventId: string, id: string) {
  const rows = await db
    .delete(preregRegistrations)
    .where(and(eq(preregRegistrations.id, id), eq(preregRegistrations.eventId, eventId)))
    .returning({ id: preregRegistrations.id });
  return rows.length > 0;
}

// ---------------------------------------------------------------- linking to the account

/**
 * Fill the empty fields of an account's saved game profile (fair_players.data.profile) from its
 * sign-ups, oldest first, and bump the revision so open devices pick it up. What the profile already
 * has is never changed. Returns the fields filled.
 */
async function fillProfile(tx: Db, userId: string, sources: PreregData[]) {
  if (!sources.length) return [];
  const [row] = await tx.select({ data: fairPlayers.data }).from(fairPlayers).where(eq(fairPlayers.userId, userId)).for("update");
  const doc = row?.data && typeof row.data === "object" && !Array.isArray(row.data) ? (row.data as Record<string, unknown>) : {};
  let profile = doc.profile as Record<string, unknown> | undefined;
  const filled: string[] = [];
  for (const d of sources) {
    const out = fillEmptyProfile(profile, profileFromPrereg(d));
    profile = out.profile;
    filled.push(...out.filled);
  }
  if (!filled.length) return [];
  const data = { ...doc, profile };
  if (row)
    await tx
      .update(fairPlayers)
      .set({ data, rev: sql`${fairPlayers.rev} + 1`, updatedAt: sql`now()` })
      .where(eq(fairPlayers.userId, userId));
  else await tx.insert(fairPlayers).values({ userId, data, rev: 1 }).onConflictDoNothing();
  return filled;
}

/**
 * Link every sign-up made with this account's email that no account has yet, and fill the profile.
 * Call only with an email Google (or our own link) verified, since that is what proves it is theirs.
 */
export async function linkPreregistrations(db: Db, user: { id: string; email: string }, now = new Date()) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(preregRegistrations)
      .set({ userId: user.id, linkedAt: now })
      .where(and(eq(preregRegistrations.email, user.email.trim().toLowerCase()), isNull(preregRegistrations.userId)))
      .returning();
    if (!rows.length) return { linked: 0, filled: [] as string[] };
    rows.sort((a, b) => +a.createdAt - +b.createdAt);
    const filled = await fillProfile(
      tx as unknown as Db,
      user.id,
      rows.map((r) => r.data as PreregData),
    );
    return { linked: rows.length, filled };
  });
}

/**
 * "Punya kode?": link one sign-up by its code. Only when it was made with this account's own email
 * (the code alone proves nothing about who is signed in); any other case answers null, the same way,
 * and the organiser can move the sign-up to the right email instead.
 */
export async function claimPrereg(db: Db, user: { id: string; email: string }, code: string) {
  const [row] = await db.select().from(preregRegistrations).where(eq(preregRegistrations.code, code));
  if (!row || row.email !== user.email.trim().toLowerCase()) return null;
  if (row.userId && row.userId !== user.id) return null;
  if (!row.userId) await linkPreregistrations(db, user);
  return row;
}

/** The events this account joined through a sign-up, and whether the one-time welcome is still to show. */
export async function myPreregistrations(db: Db, userId: string) {
  const rows = await db
    .select({ id: preregRegistrations.id, code: preregRegistrations.code, linkedAt: preregRegistrations.linkedAt, welcomedAt: preregRegistrations.welcomedAt, event: preregEvents })
    .from(preregRegistrations)
    .innerJoin(preregEvents, eq(preregEvents.id, preregRegistrations.eventId))
    .where(and(eq(preregRegistrations.userId, userId), isNotNull(preregRegistrations.linkedAt)))
    .orderBy(asc(preregEvents.startDate));
  return rows;
}

/** The welcome was shown: don't show it again for these sign-ups. */
export async function markPreregWelcomed(db: Db, userId: string) {
  await db
    .update(preregRegistrations)
    .set({ welcomedAt: new Date() })
    .where(and(eq(preregRegistrations.userId, userId), isNull(preregRegistrations.welcomedAt)));
}

/** A sign-up by its email, for sending its own code back to that email. Never returned to a caller. */
export async function preregByEmail(db: Db, eventId: string, email: string) {
  const [row] = await db
    .select()
    .from(preregRegistrations)
    .where(and(eq(preregRegistrations.eventId, eventId), eq(preregRegistrations.email, email.trim().toLowerCase())));
  return row ?? null;
}
