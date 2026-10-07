// End-to-end over real sockets: two players race for the same seat and only one wins;
// everyone on the floor sees the seat change and the updated counters.
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkIn, createDb, schema } from "@vwo/db";
import type { ClientToServerEvents, ServerToClientEvents } from "@vwo/shared";
import { createRealtimeServer } from "../src/server";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);
let http: HttpServer;
let base: string;
let seatId: string;
const clients: Client[] = [];

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../../packages/db/migrations", import.meta.url)),
  });
  const [owner] = await db.insert(schema.users).values({ email: "o@test", displayName: "O" }).returning();
  const [venue] = await db
    .insert(schema.venues)
    .values({ slug: "rt-cafe", name: "RT", ownerUserId: owner!.id, status: "open" })
    .returning();
  const [floor] = await db.insert(schema.floors).values({ venueId: venue!.id, name: "L1", width: 10, height: 10 }).returning();
  const [seat] = await db
    .insert(schema.seats)
    .values({ venueId: venue!.id, floorId: floor!.id, label: "S1", x: 3, y: 3 })
    .returning();
  seatId = seat!.id;

  http = createServer();
  createRealtimeServer(http, db);
  await new Promise<void>((r) => http.listen(0, r));
  base = `http://localhost:${(http.address() as AddressInfo).port}`;
});

afterAll(async () => {
  clients.forEach((c) => c.disconnect());
  await new Promise((r) => http.close(r));
  await close();
});

async function player(email: string) {
  const [user] = await db.insert(schema.users).values({ email, displayName: email }).returning();
  const venue = await db.query.venues.findFirst();
  const { visit, host } = await checkIn(db, { venueId: venue!.id, userId: user!.id, hostName: email, method: "qr_entrance" });
  const socket: Client = connect(base, { transports: ["websocket"], forceNew: true });
  clients.push(socket);
  const res = await socket.timeout(5000).emitWithAck("world:join", {
    venueSlug: "rt-cafe",
    visitId: visit.id,
    memberId: host.id,
    displayName: email,
  });
  expect(res.ok).toBe(true);
  return { socket, memberId: host.id };
}

describe("realtime world", () => {
  it("rejects unknown venues", async () => {
    const s: Client = connect(base, { transports: ["websocket"], forceNew: true });
    clients.push(s);
    const res = await s.timeout(5000).emitWithAck("world:join", { venueSlug: "nope", displayName: "x" });
    expect(res).toEqual({ ok: false, error: "venue_not_found" });
  });

  it("gives a contested seat to exactly one player and tells everyone", async () => {
    const a = await player("a@test");
    const b = await player("b@test");
    const seen = new Promise<{ seatId: string; memberId: string | null }>((resolve) =>
      b.socket.on("seat:updated", resolve),
    );

    const [ra, rb] = await Promise.all([
      a.socket.timeout(5000).emitWithAck("seat:claim", { assignments: [{ memberId: a.memberId, seatId }] }),
      b.socket.timeout(5000).emitWithAck("seat:claim", { assignments: [{ memberId: b.memberId, seatId }] }),
    ]);
    const results = [ra, rb];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: "seat_taken" }]);

    const update = await seen;
    expect(update.seatId).toBe(seatId);
    expect([a.memberId, b.memberId]).toContain(update.memberId);
  });

  it("does not let a player seat someone else's member", async () => {
    const a = await player("c@test");
    const b = await player("d@test");
    const res = await a.socket.timeout(5000).emitWithAck("seat:claim", { assignments: [{ memberId: b.memberId, seatId }] });
    expect(res).toEqual({ ok: false, error: "not_allowed" });
  });
});
