// Stand moves and stand bookings decide from the same documents under one lock: two writers at
// once take turns, so the second sees what the first wrote and can't take the same slot.
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, putFairStateLocked, readFairStateKey } from "../src";
import { users } from "../src/schema";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);
let admin: string;

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  [{ id: admin }] = (await db.insert(users).values({ email: "panitia@jobfair.example", displayName: "Panitia" }).returning({ id: users.id })) as [{ id: string }];
});

afterAll(async () => {
  await close();
});

describe("putFairStateLocked", () => {
  it("lets only one of two writers at once take a slot, and replaces a document it already wrote", async () => {
    const slotTaken = (rows: { key: string; data: unknown }[]) =>
      rows.some((r) => r.key.startsWith("booking:") || (r.key === "placement" && (r.data as { taken?: boolean }).taken));
    // A stand move and a booking for the same slot, at the same moment.
    const both = await Promise.all([
      putFairStateLocked(db, "stands", admin, (rows) => (slotTaken(rows) ? { error: "slot_taken" } : { key: "placement", data: { taken: true } })),
      putFairStateLocked(db, "stands", admin, (rows) => (slotTaken(rows) ? { error: "slot_taken" } : { key: "booking:kopi", data: { id: "kopi" } })),
    ]);
    expect(both.filter((r) => "error" in r)).toHaveLength(1);
    // A second write of the same key replaces it.
    await putFairStateLocked(db, "other", admin, () => ({ key: "placement", data: { placements: { a: { floor: 1, x: 3, y: 0.4 } } } }));
    expect((await readFairStateKey(db, "placement"))?.data).toEqual({ placements: { a: { floor: 1, x: 3, y: 0.4 } } });
  });
});
