// The talent pool is read from applications and saved profiles; offers live in fair_state, out of the event setup.
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AlreadyOfferedError,
  addSeekerOffer,
  createDb,
  dropSeekerOffer,
  openSeekers,
  poolApplications,
  readFairState,
  seekerOffers,
  seekerProfiles,
  submitFairApplication,
  writeFairPlayer,
  writeFairState,
} from "../src";
import { users } from "../src/schema";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);
let sari: string;
let budi: string;

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  const made = await db
    .insert(users)
    .values([
      { email: "sari@mail.example", displayName: "Sari" },
      { email: "budi@mail.example", displayName: "Budi" },
    ])
    .returning({ id: users.id });
  sari = made[0]!.id;
  budi = made[1]!.id;
});

afterAll(async () => {
  await close();
});

describe("talent pool", () => {
  it("reads a booth's applications without photos, and profiles without photos", async () => {
    await submitFairApplication(db, {
      userId: sari,
      boothKey: "nusa",
      jobKey: "fe",
      data: { jobTitle: "Frontend", name: "Sari", email: "sari@mail.example", photo: "data:image/png;base64,AA", message: "Halo" },
    });
    await submitFairApplication(db, { userId: budi, boothKey: "lain", jobKey: "x", data: { jobTitle: "X", name: "Budi" } });
    const apps = await poolApplications(db, ["nusa"]);
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ seeker: sari, boothId: "nusa", jobId: "fe", jobTitle: "Frontend", status: "Terkirim" });
    expect(apps[0]!.data.photo).toBeUndefined();
    expect(apps[0]!.data.message).toBeUndefined();
    expect(await poolApplications(db, [])).toEqual([]);

    await writeFairPlayer(db, { userId: sari, rev: 0, data: { profile: { skills: "React", photo: "data:image/png;base64,AA", contactable: false } } });
    await writeFairPlayer(db, { userId: budi, rev: 0, data: { profile: { skills: "Go", contactable: true } } });
    const profiles = await seekerProfiles(db, [sari]);
    expect(profiles.get(sari)).toEqual({ skills: "React", contactable: false });
  });

  it("finds only the seekers who switched contact on", async () => {
    expect((await openSeekers(db)).map((s) => s.userId)).toEqual([budi]);
  });

  it("keeps one offer per vacancy, out of the event setup, until the seeker drops it", async () => {
    const offer = { id: "6f1c2a1e-0000-4000-8000-000000000001", boothId: "nusa", jobId: "be", company: "Nusa", jobTitle: "Backend", at: 1 };
    await addSeekerOffer(db, budi, offer, sari);
    await expect(addSeekerOffer(db, budi, { ...offer, id: "6f1c2a1e-0000-4000-8000-000000000002" }, sari)).rejects.toBeInstanceOf(AlreadyOfferedError);
    expect((await seekerOffers(db, budi)).map((o) => o.id)).toEqual([offer.id]);
    expect(await seekerOffers(db, sari)).toEqual([]);
    await writeFairState(db, { key: "org", data: {}, userId: sari });
    expect((await readFairState(db)).map((r) => r.key)).toEqual(["org"]);
    expect(await dropSeekerOffer(db, sari, offer.id)).toBe(false);
    expect(await dropSeekerOffer(db, budi, offer.id)).toBe(true);
    expect(await seekerOffers(db, budi)).toEqual([]);
  });
});
