// The seminar registration route, end to end against the test database: session, origin, rate
// limit, input, the organiser's setup as the only source of times and seats.
import { createDb, writeFairState } from "@vwo/db";
import { users } from "@vwo/db/schema";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: null as null | { id: string; email: string; role: string; earlyOrganizer: boolean } }));
vi.mock("@/lib/session", () => ({ currentUser: async () => auth.user }));

const { GET, POST } = await import("../app/api/jobfair/seminars/route");
const registrants = await import("../app/api/jobfair/seminars/registrants/route");

const { db, close } = createDb(process.env.DATABASE_URL);
const people: { id: string; email: string }[] = [];
const HOUR = 3_600_000;

const as = (i: number | null) => {
  auth.user = i === null ? null : { ...people[i]!, role: "seeker", earlyOrganizer: false };
};
const post = (body: unknown, origin = "https://jobfair.co.id") =>
  POST(
    new Request("https://jobfair.co.id/api/jobfair/seminars", {
      method: "POST",
      headers: { origin, "x-forwarded-host": "jobfair.co.id", "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../../packages/db/migrations", import.meta.url)) });
  people.push(
    ...(await db
      .insert(users)
      .values([1, 2, 3].map((i) => ({ email: `seeker${i}@mail.example`, displayName: `Seeker ${i}` })))
      .returning({ id: users.id, email: users.email })),
  );
  const now = Date.now();
  await writeFairState(db, {
    key: "org",
    userId: people[0]!.id,
    data: {
      seminars: [
        { id: "cv", title: "CV yang Dilirik Recruiter", speaker: "Kak Nadia", role: "", slides: [], startAt: now + 24 * HOUR, minutes: 60, capacity: 2 },
        { id: "done", title: "Sudah lewat", speaker: "Pak Arif", role: "", slides: [], startAt: now - 3 * HOUR, minutes: 60 },
        { id: "tbd", title: "Belum dijadwalkan", speaker: "Mas Dimas", role: "", slides: [] },
      ],
    },
  });
});

beforeEach(() => as(null));

afterAll(async () => {
  await close();
});

describe("POST /api/jobfair/seminars", () => {
  it("needs a signed-in account and our own origin", async () => {
    expect((await post({ seminarId: "cv", register: true })).status).toBe(401);
    as(0);
    expect((await post({ seminarId: "cv", register: true }, "https://evil.example")).status).toBe(403);
  });

  it("validates the input and only knows the organiser's sessions", async () => {
    as(0);
    expect((await post({ seminarId: "../org", register: true })).status).toBe(400);
    expect((await post({ seminarId: "cv", register: "yes" })).status).toBe(400);
    expect((await post({ seminarId: "nope", register: true })).status).toBe(404);
  });

  it("registers, cancels, and refuses finished or undated sessions", async () => {
    as(0);
    const r = await post({ seminarId: "cv", register: true });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, registered: true, count: 1 });
    expect(await (await post({ seminarId: "cv", register: false })).json()).toEqual({ ok: true, registered: false, count: 0 });
    const ended = await post({ seminarId: "done", register: true });
    expect(ended.status).toBe(409);
    expect((await ended.json()).error).toBe("ended");
    expect((await (await post({ seminarId: "tbd", register: true })).json()).error).toBe("unscheduled");
  });

  it("enforces the seats on the server", async () => {
    as(0);
    expect((await post({ seminarId: "cv", register: true })).status).toBe(200);
    as(1);
    expect((await post({ seminarId: "cv", register: true })).status).toBe(200);
    as(2);
    const full = await post({ seminarId: "cv", register: true });
    expect(full.status).toBe(409);
    expect(await full.json()).toEqual({ error: "full", count: 2 });
  });

  it("shows counts to everyone and each account only its own registrations", async () => {
    as(1);
    expect(await (await GET()).json()).toEqual({ counts: { cv: 2 }, mine: ["cv"] });
    as(2);
    expect(await (await GET()).json()).toEqual({ counts: { cv: 2 }, mine: [] });
    as(null);
    expect((await (await GET()).json()).mine).toEqual([]);
  });

  it("gives the registrant list to event admins only", async () => {
    const req = () => registrants.GET(new Request("https://jobfair.co.id/api/jobfair/seminars/registrants?id=cv"));
    expect((await req()).status).toBe(401);
    as(2);
    expect((await req()).status).toBe(403);
    auth.user = { ...people[2]!, role: "super_admin", earlyOrganizer: false };
    const list = (await (await req()).json()) as { registrants: { email: string }[] };
    expect(list.registrants.map((r) => r.email).sort()).toEqual([people[0]!.email, people[1]!.email].sort());
  });

  it("rate-limits registration changes per account", async () => {
    as(2);
    const codes: number[] = [];
    for (let i = 0; i < 31; i++) codes.push((await post({ seminarId: "tbd", register: false })).status);
    // Earlier tests used a few of this account's 30 per 10 minutes.
    expect(codes.at(-1)).toBe(429);
    expect(codes.filter((c) => c === 200).length).toBeGreaterThan(20);
  });
});
