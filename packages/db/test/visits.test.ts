// Integration tests against a real Postgres: the seat rules live in partial unique indexes,
// so they can only be verified with the database itself.
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  SeatTakenError,
  VisitRuleError,
  checkIn,
  checkOut,
  claimSeats,
  createDb,
  getLiveSnapshot,
  joinGroup,
  memberLeave,
  releaseSeat,
} from "../src";
import { cafeTables, floors, seats, users, venues, visitEvents } from "../src/schema";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);

let venueId: string;
let floorId: string;
let seatIds: string[];
let alice: string;
let bob: string;

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.execute(sql`truncate table venues, users cascade`);
  const [a, b] = await db
    .insert(users)
    .values([
      { email: "alice@test", displayName: "Alice" },
      { email: "bob@test", displayName: "Bob" },
    ])
    .returning();
  alice = a!.id;
  bob = b!.id;
  const [v] = await db.insert(venues).values({ slug: "test-cafe", name: "Test", ownerUserId: alice }).returning();
  venueId = v!.id;
  const [f] = await db.insert(floors).values({ venueId, name: "L1", width: 10, height: 10 }).returning();
  floorId = f!.id;
  const [t] = await db.insert(cafeTables).values({ venueId, floorId, label: "T1", x: 2, y: 2 }).returning();
  const s = await db
    .insert(seats)
    .values(["A", "B", "C", "D"].map((l, i) => ({ venueId, floorId, tableId: t!.id, label: `T1-${l}`, x: i, y: 0 })))
    .returning();
  seatIds = s.map((r) => r.id);
});

describe("check-in", () => {
  it("creates a host plus companions and logs the arrival", async () => {
    const { visit, host, companions } = await checkIn(db, {
      venueId,
      userId: alice,
      hostName: "Alice",
      method: "qr_entrance",
      companions: ["Ayah", "Ibu", "Adik"],
      floorId,
    });
    expect(host.memberType).toBe("host");
    expect(companions).toHaveLength(3);
    expect(companions.every((c) => c.followsMemberId === host.id)).toBe(true);
    expect(visit.groupCode).toMatch(/^[A-Z0-9]{6}$/);

    const live = await getLiveSnapshot(db, venueId);
    expect(live.peopleInside).toBe(4);
    expect(live.groupsInside).toBe(1);

    const events = await db.select().from(visitEvents);
    expect(events.map((e) => e.type)).toEqual(["check_in"]);
  });

  it("refuses a second active check-in for the same user at the same venue", async () => {
    await checkIn(db, { venueId, userId: alice, hostName: "Alice", method: "qr_entrance" });
    await expect(checkIn(db, { venueId, userId: alice, hostName: "Alice", method: "qr_entrance" })).rejects.toBeInstanceOf(
      VisitRuleError,
    );
  });

  it("records a staff walk-in without an app account", async () => {
    const { host } = await checkIn(db, { venueId, userId: null, hostName: "Pak Budi", method: "staff", checkedInByUserId: bob, companions: ["Tamu 1"] });
    expect(host.userId).toBeNull();
    expect((await getLiveSnapshot(db, venueId)).peopleInside).toBe(2);
  });
});

describe("seats", () => {
  it("allows only one person per seat", async () => {
    const a = await checkIn(db, { venueId, userId: alice, hostName: "Alice", method: "qr_entrance" });
    const b = await checkIn(db, { venueId, userId: bob, hostName: "Bob", method: "qr_entrance" });
    await claimSeats(db, { visitId: a.visit.id, assignments: [{ memberId: a.host.id, seatId: seatIds[0]! }] });
    await expect(
      claimSeats(db, { visitId: b.visit.id, assignments: [{ memberId: b.host.id, seatId: seatIds[0]! }] }),
    ).rejects.toBeInstanceOf(SeatTakenError);
  });

  it("seats a whole group at once, or nobody if one seat is taken", async () => {
    const other = await checkIn(db, { venueId, userId: bob, hostName: "Bob", method: "qr_entrance" });
    await claimSeats(db, { visitId: other.visit.id, assignments: [{ memberId: other.host.id, seatId: seatIds[3]! }] });

    const fam = await checkIn(db, { venueId, userId: alice, hostName: "Alice", method: "qr_entrance", companions: ["Ayah", "Ibu", "Adik"] });
    const members = [fam.host, ...fam.companions];
    await expect(
      claimSeats(db, { visitId: fam.visit.id, assignments: members.map((m, i) => ({ memberId: m.id, seatId: seatIds[i]! })) }),
    ).rejects.toBeInstanceOf(SeatTakenError);
    expect((await getLiveSnapshot(db, venueId)).seatsOccupied).toBe(1);

    await releaseSeat(db, { memberId: other.host.id });
    await claimSeats(db, {
      visitId: fam.visit.id,
      source: "host",
      assignments: members.map((m, i) => ({ memberId: m.id, seatId: seatIds[i]! })),
    });
    const live = await getLiveSnapshot(db, venueId);
    expect(live.seatsOccupied).toBe(4);
    expect(live.seatsFree).toBe(0);
  });

  it("moves a member to a new seat instead of holding two", async () => {
    const a = await checkIn(db, { venueId, userId: alice, hostName: "Alice", method: "qr_entrance" });
    await claimSeats(db, { visitId: a.visit.id, assignments: [{ memberId: a.host.id, seatId: seatIds[0]! }] });
    await claimSeats(db, { visitId: a.visit.id, assignments: [{ memberId: a.host.id, seatId: seatIds[1]! }] });
    const live = await getLiveSnapshot(db, venueId);
    expect(live.occupiedSeatIds).toEqual([seatIds[1]]);
  });
});

describe("groups and leaving", () => {
  it("lets a family member take over an NPC slot with the group code", async () => {
    const fam = await checkIn(db, { venueId, userId: alice, hostName: "Alice", method: "qr_entrance", companions: ["Adik"] });
    const member = await joinGroup(db, { groupCode: fam.visit.groupCode!, userId: bob, displayName: "Bob", takeOverMemberId: fam.companions[0]!.id });
    expect(member.memberType).toBe("app_user");
    expect(member.userId).toBe(bob);
    expect((await getLiveSnapshot(db, venueId)).peopleInside).toBe(2);
  });

  it("lets one member leave early and frees only their seat", async () => {
    const fam = await checkIn(db, { venueId, userId: alice, hostName: "Alice", method: "qr_entrance", companions: ["Adik"] });
    await claimSeats(db, {
      visitId: fam.visit.id,
      assignments: [
        { memberId: fam.host.id, seatId: seatIds[0]! },
        { memberId: fam.companions[0]!.id, seatId: seatIds[1]! },
      ],
    });
    await memberLeave(db, { memberId: fam.companions[0]!.id });
    const live = await getLiveSnapshot(db, venueId);
    expect(live.peopleInside).toBe(1);
    expect(live.occupiedSeatIds).toEqual([seatIds[0]]);
  });

  it("check-out closes every member and seat and is logged", async () => {
    const fam = await checkIn(db, { venueId, userId: alice, hostName: "Alice", method: "qr_entrance", companions: ["Adik"] });
    await claimSeats(db, { visitId: fam.visit.id, assignments: [{ memberId: fam.host.id, seatId: seatIds[0]! }] });
    await checkOut(db, { visitId: fam.visit.id, method: "self", actorUserId: alice });

    const live = await getLiveSnapshot(db, venueId);
    expect(live.peopleInside).toBe(0);
    expect(live.seatsOccupied).toBe(0);
    const types = (await db.select().from(visitEvents)).map((e) => e.type);
    expect(types).toContain("check_out");

    // The same user can come back later.
    await checkIn(db, { venueId, userId: alice, hostName: "Alice", method: "qr_entrance" });
  });
});
