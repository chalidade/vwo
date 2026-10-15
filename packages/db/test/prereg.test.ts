// Pre-registration under the database: one sign-up per (event, email) with the same code on a change,
// no change or read without the code, capacity holds when many send at once, and linking on sign-in
// fills only the profile's empty fields.
import { preregInput } from "@vwo/shared";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  claimPrereg,
  createDb,
  deletePreregs,
  holdUntil,
  preregByCode,
  preregFormData,
  preregSignals,
  setHold,
  createPreregEvent,
  deletePreregEvent,
  findPrereg,
  linkPreregistrations,
  markPreregWelcomed,
  myPreregistrations,
  openPreregEvents,
  preregEventBySlug,
  preregRegistrants,
  readFairPlayer,
  setPreregEmail,
  submitPrereg,
  updatePreregEvent,
  writeFairPlayer,
} from "../src";
import { fairPlayers, preregEvents } from "../src/jobfair-schema";
import { users } from "../src/schema";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);

const form = (over: Record<string, unknown> = {}) =>
  preregInput.parse({
    fullName: "Sari Wulandari",
    email: "sari@gmail.com",
    whatsapp: "0812 3456 7890",
    city: "Kota Bandung",
    age: "18–22",
    education: "S1",
    major: "Teknik Informatika",
    institution: "Universitas Padjadjaran",
    status: "Fresh graduate",
    fields: ["Teknologi informasi"],
    jobTypes: ["Full-time"],
    skills: "react, SQL",
    experience: "Magang 6 bulan",
    link: "linkedin.com/in/sari",
    consent: true,
    ...over,
  });

const event = (over: Record<string, unknown> = {}) =>
  createPreregEvent(db, { name: "Job Fair Bandung 2027", startDate: "2027-03-10", endDate: "2027-03-12", location: "Online", about: "", open: true, ...over } as never, null);

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
});

beforeEach(async () => {
  await db.delete(preregEvents);
  await db.delete(fairPlayers);
  await db.delete(users);
});

afterAll(async () => {
  await close();
});

describe("events", () => {
  it("makes the address from the name and adds -2 when it is taken", async () => {
    const a = await event();
    const b = await event();
    expect(a.slug).toBe("job-fair-bandung-2027");
    expect(b.slug).toBe("job-fair-bandung-2027-2");
    expect(a.startDate).toBe("2027-03-10");
  });

  it("lists only events taking sign-ups on the landing", async () => {
    await event({ name: "Buka" });
    await event({ name: "Tutup", open: false });
    await event({ name: "Lewat", deadline: new Date(Date.now() - 60_000).toISOString() });
    expect((await openPreregEvents(db)).map((r) => r.event.name)).toEqual(["Buka"]);
  });

  it("refuses a typed address another event has", async () => {
    await event({ name: "Satu", slug: "satu" });
    const b = await event({ name: "Dua", slug: "dua" });
    expect(await updatePreregEvent(db, b.id, { name: "Dua", slug: "satu", startDate: "", endDate: "", location: "Online", about: "", open: true } as never)).toBe("slug_taken");
  });

  it("deletes an event only while nobody signed up", async () => {
    const e = await event();
    await submitPrereg(db, { eventId: e.id, data: form(), code: null });
    expect(await deletePreregEvent(db, e.id)).toBe(false);
    const empty = await event({ name: "Kosong" });
    expect(await deletePreregEvent(db, empty.id)).toBe(true);
  });
});

describe("sign-ups", () => {
  it("gives a readable code and keeps it when the same email changes its data with that code", async () => {
    const e = await event();
    const first = await submitPrereg(db, { eventId: e.id, data: form(), code: null });
    expect(first.status).toBe("created");
    if (first.status !== "created") return;
    expect(first.code).toMatch(/^JF-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    const again = await submitPrereg(db, { eventId: e.id, data: form({ city: "Kota Cimahi" }), code: first.code });
    expect(again).toMatchObject({ status: "updated", code: first.code });
    const rows = await preregRegistrants(db, e.id);
    expect(rows).toHaveLength(1);
    expect((rows[0]!.data as { city: string }).city).toBe("Kota Cimahi");
  });

  it("changes nothing for the same email without its code (no overwriting someone else's sign-up)", async () => {
    const e = await event();
    const first = await submitPrereg(db, { eventId: e.id, data: form(), code: null });
    expect(await submitPrereg(db, { eventId: e.id, data: form({ fullName: "Penyusup" }), code: null })).toEqual({ status: "exists" });
    expect(await submitPrereg(db, { eventId: e.id, data: form({ fullName: "Penyusup" }), code: "JF-2222-2222" })).toEqual({ status: "exists" });
    const [row] = await preregRegistrants(db, e.id);
    expect((row!.data as { fullName: string }).fullName).toBe("Sari Wulandari");
    expect(first.status).toBe("created");
  });

  it("shows a sign-up only to the matching email and code", async () => {
    const e = await event();
    const other = await event({ name: "Lain" });
    const r = await submitPrereg(db, { eventId: e.id, data: form(), code: null });
    if (r.status !== "created") throw new Error(r.status);
    expect(await findPrereg(db, e.id, "SARI@gmail.com ", r.code)).toMatchObject({ code: r.code });
    expect(await findPrereg(db, e.id, "lain@gmail.com", r.code)).toBeNull();
    expect(await findPrereg(db, e.id, "sari@gmail.com", "JF-2222-2222")).toBeNull();
    expect(await findPrereg(db, other.id, "sari@gmail.com", r.code)).toBeNull();
  });

  it("holds the capacity when many send at once, and refuses closed events", async () => {
    const e = await event({ capacity: 3 });
    const out = await Promise.all(Array.from({ length: 8 }, (_, i) => submitPrereg(db, { eventId: e.id, data: form({ email: `p${i}@gmail.com` }), code: null })));
    expect(out.filter((o) => o.status === "created")).toHaveLength(3);
    expect(out.filter((o) => o.status === "full")).toHaveLength(5);
    expect((await preregEventBySlug(db, e.slug))!.count).toBe(3);
    const closed = await event({ name: "Tutup", open: false });
    expect(await submitPrereg(db, { eventId: closed.id, data: form(), code: null })).toEqual({ status: "closed" });
  });

  it("gives every sign-up its own code", async () => {
    const e = await event();
    const codes = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const r = await submitPrereg(db, { eventId: e.id, data: form({ email: `u${i}@gmail.com` }), code: null });
      if (r.status === "created") codes.add(r.code);
    }
    expect(codes.size).toBe(40);
  });

  it("finds registrants by name, code or campus for the organiser", async () => {
    const e = await event();
    const r = await submitPrereg(db, { eventId: e.id, data: form(), code: null });
    await submitPrereg(db, { eventId: e.id, data: form({ email: "budi@gmail.com", fullName: "Budi", institution: "ITB" }), code: null });
    expect((await preregRegistrants(db, e.id, "sari")).map((x) => x.email)).toEqual(["sari@gmail.com"]);
    expect((await preregRegistrants(db, e.id, "itb")).map((x) => x.email)).toEqual(["budi@gmail.com"]);
    if (r.status === "created") expect(await preregRegistrants(db, e.id, r.code)).toHaveLength(1);
    expect(await preregRegistrants(db, e.id, "%")).toHaveLength(0);
  });
});

describe("linking on sign-in", () => {
  const account = async (email: string) => {
    const [u] = await db.insert(users).values({ email, displayName: "X" }).returning({ id: users.id });
    return { id: u!.id, email };
  };

  it("links the email's sign-ups and fills only the profile's empty fields", async () => {
    const e = await event();
    await submitPrereg(db, { eventId: e.id, data: form(), code: null });
    const u = await account("sari@gmail.com");
    await writeFairPlayer(db, { userId: u.id, rev: 0, data: { profile: { name: "Sari W.", headline: "", phone: "0899", city: "" }, player: { coins: 5 } } });
    const out = await linkPreregistrations(db, u);
    expect(out.linked).toBe(1);
    const saved = await readFairPlayer(db, u.id);
    const p = (saved!.data as { profile: Record<string, string> }).profile;
    expect(p.name).toBe("Sari W.");
    expect(p.phone).toBe("0899");
    expect(p.city).toBe("Kota Bandung");
    expect(p.headline).toBe("Fresh graduate Teknik Informatika");
    expect(p.education).toBe("S1 Teknik Informatika");
    expect(p.campus).toBe("Universitas Padjadjaran");
    expect(p.skills).toBe("React, SQL");
    expect(p.cvUrl).toBe("https://linkedin.com/in/sari");
    expect((saved!.data as { player: { coins: number } }).player.coins).toBe(5);
    expect(saved!.rev).toBe(2);
    // Once linked, signing in again changes nothing.
    expect((await linkPreregistrations(db, u)).linked).toBe(0);
  });

  it("starts a profile for an account that has no saved progress yet", async () => {
    const e = await event();
    await submitPrereg(db, { eventId: e.id, data: form(), code: null });
    const u = await account("sari@gmail.com");
    await linkPreregistrations(db, u);
    const saved = await readFairPlayer(db, u.id);
    expect((saved!.data as { profile: { name: string } }).profile.name).toBe("Sari Wulandari");
  });

  it("shows the welcome once", async () => {
    const e = await event();
    await submitPrereg(db, { eventId: e.id, data: form(), code: null });
    const u = await account("sari@gmail.com");
    await linkPreregistrations(db, u);
    expect((await myPreregistrations(db, u.id)).filter((r) => !r.welcomedAt)).toHaveLength(1);
    await markPreregWelcomed(db, u.id);
    expect((await myPreregistrations(db, u.id)).filter((r) => !r.welcomedAt)).toHaveLength(0);
  });

  it("claims by code only for the email it was made with", async () => {
    const e = await event();
    const r = await submitPrereg(db, { eventId: e.id, data: form(), code: null });
    if (r.status !== "created") throw new Error(r.status);
    const stranger = await account("lain@gmail.com");
    expect(await claimPrereg(db, stranger, r.code)).toBeNull();
    expect(await myPreregistrations(db, stranger.id)).toHaveLength(0);
    const owner = await account("sari@gmail.com");
    expect(await claimPrereg(db, owner, r.code)).toMatchObject({ code: r.code });
    expect(await myPreregistrations(db, owner.id)).toHaveLength(1);
  });

  it("lets the organiser move a sign-up to the right email, unlinking it", async () => {
    const e = await event();
    const r = await submitPrereg(db, { eventId: e.id, data: form({ email: "sari@yahoo.com" }), code: null });
    if (r.status !== "created") throw new Error(r.status);
    const moved = await setPreregEmail(db, e.id, r.registration.id, "sari@gmail.com");
    expect(moved).toMatchObject({ email: "sari@gmail.com", userId: null });
    expect((moved as { data: { email: string } }).data.email).toBe("sari@gmail.com");
    const u = await account("sari@gmail.com");
    expect((await linkPreregistrations(db, u)).linked).toBe(1);
  });
});

describe("bot checks' state", () => {
  it("keeps what was kept about the first sending through a change, and finds the inbox by its hash", async () => {
    const e = await event();
    const made = await submitPrereg(db, { eventId: e.id, data: form(), code: null, signals: { ib: "net1", ek: "inbox1", ft: 95 } });
    if (made.status !== "created") throw new Error(made.status);
    const changed = await submitPrereg(db, { eventId: e.id, data: form({ city: "Kota Cimahi" }), code: made.code, signals: { ib: "net2", ek: "inbox1", ft: 4 } });
    if (changed.status !== "updated") throw new Error(changed.status);
    expect(preregSignals(changed.registration.data)).toEqual({ ib: "net1", ek: "inbox1", ft: 95 });
    expect(preregFormData(changed.registration.data)).not.toHaveProperty("_sig");
    expect(preregFormData(changed.registration.data).city).toBe("Kota Cimahi");
    // Another spelling of the same inbox makes no second sign-up, even when many are sent at once.
    const twins = await Promise.all(
      ["s.ari@gmail.com", "sari+1@gmail.com", "sa.ri@gmail.com"].map((email) => submitPrereg(db, { eventId: e.id, data: form({ email }), code: null, signals: { ek: "inbox1" } })),
    );
    expect(twins.map((t) => t.status)).toEqual(["same_inbox", "same_inbox", "same_inbox"]);
    expect(await preregRegistrants(db, e.id)).toHaveLength(1);
    expect((await submitPrereg(db, { eventId: e.id, data: form({ email: "budi@gmail.com" }), code: null, signals: { ek: "other" } })).status).toBe("created");
    expect((await preregByCode(db, e.id, made.code))?.email).toBe("sari@gmail.com");
  });

  it("deletes many sign-ups of one event only", async () => {
    const e = await event();
    const other = await event();
    const ids: string[] = [];
    for (const email of ["a@gmail.com", "b@gmail.com"]) {
      const r = await submitPrereg(db, { eventId: e.id, data: form({ email }), code: null });
      if (r.status === "created") ids.push(r.registration.id);
    }
    const keep = await submitPrereg(db, { eventId: other.id, data: form(), code: null });
    if (keep.status !== "created") throw new Error(keep.status);
    expect(await deletePreregs(db, e.id, [...ids, keep.registration.id])).toBe(2);
    expect(await preregRegistrants(db, other.id)).toHaveLength(1);
  });

  it("holds a key until its end, keeping a later end", async () => {
    expect(await holdUntil(db, "prereg:slow:x")).toBeNull();
    await setHold(db, "prereg:slow:x", 60_000);
    const first = await holdUntil(db, "prereg:slow:x");
    expect(first!.getTime()).toBeGreaterThan(Date.now());
    await setHold(db, "prereg:slow:x", 1_000);
    expect((await holdUntil(db, "prereg:slow:x"))!.getTime()).toBe(first!.getTime());
  });
});
