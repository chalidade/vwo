// Realtime world server. One Socket.IO room per floor ("floor:<id>") and one per venue
// ("venue:<id>") for counters. Avatar positions live only in memory here (Redis adapter
// comes when we run more than one instance); seats and visits go through @vwo/db.
//
// NOTE (base): clients identify with visitId + memberId and the server checks that the
// member is active in that visit. Signed session tokens replace this once auth lands.
import type { Server as HttpServer } from "node:http";
import { and, eq, isNull } from "drizzle-orm";
import { Server, type Socket } from "socket.io";
import {
  type Db,
  SeatTakenError,
  VisitRuleError,
  claimSeats,
  getLiveSnapshot,
  getVenueBySlug,
  releaseSeat,
  schema,
} from "@vwo/db";
import {
  type AvatarState,
  type ClientToServerEvents,
  EMOTES,
  type Facing,
  facingFor,
  MOVE_RATE_LIMIT_HZ,
  type ServerToClientEvents,
} from "@vwo/shared";

const FACINGS: readonly Facing[] = ["front", "back", "left", "right"];

interface SocketData {
  venueId?: string;
  floorId?: string;
  visitId?: string;
  /** Members this socket controls: the player plus companions that follow them. */
  memberIds: string[];
  playerMemberId?: string;
  lastMoveAt: number;
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

interface FloorInfo {
  id: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
}

export function createRealtimeServer(http: HttpServer, db: Db, opts: { corsOrigin?: string | string[] } = {}) {
  const io: IO = new Server(http, { cors: { origin: opts.corsOrigin ?? "*" } });
  /** floorId -> memberId -> avatar */
  const world = new Map<string, Map<string, AvatarState>>();
  const floorCache = new Map<string, FloorInfo>();

  const avatarsOn = (floorId: string) => {
    let m = world.get(floorId);
    if (!m) world.set(floorId, (m = new Map()));
    return m;
  };

  async function loadFloor(venueId: string, floorId?: string): Promise<FloorInfo | null> {
    if (floorId && floorCache.has(floorId)) return floorCache.get(floorId)!;
    const floor = await db.query.floors.findFirst({
      where: floorId
        ? and(eq(schema.floors.id, floorId), eq(schema.floors.venueId, venueId))
        : eq(schema.floors.venueId, venueId),
      orderBy: (f, { asc }) => [asc(f.sortOrder)],
    });
    if (!floor) return null;
    const spawn = await db.query.mapObjects.findFirst({
      where: and(eq(schema.mapObjects.floorId, floor.id), eq(schema.mapObjects.type, "spawn_point")),
    });
    const info = {
      id: floor.id,
      width: floor.width,
      height: floor.height,
      spawn: spawn ? { x: spawn.x, y: spawn.y } : { x: floor.width / 2, y: floor.height - 1 },
    };
    floorCache.set(floor.id, info);
    return info;
  }

  async function broadcastCounts(venueId: string) {
    const live = await getLiveSnapshot(db, venueId);
    io.to(`venue:${venueId}`).emit("venue:counts", {
      peopleInside: live.peopleInside,
      seatsFree: live.seatsFree,
      seatsTotal: live.seatsTotal,
    });
  }

  function placeAt(
    floorId: string,
    memberId: string,
    x: number,
    y: number,
    opts: { seatId?: string | null; facing?: Facing } = {},
  ) {
    const avatar = avatarsOn(floorId).get(memberId);
    if (!avatar) return;
    avatar.facing = opts.facing ?? facingFor(x - avatar.x, y - avatar.y, avatar.facing);
    avatar.x = x;
    avatar.y = y;
    if (opts.seatId !== undefined) avatar.seatId = opts.seatId;
    io.to(`floor:${floorId}`).emit("avatar:moved", { memberId, x, y, facing: avatar.facing });
  }

  io.on("connection", (socket: ClientSocket) => {
    socket.data.memberIds = [];
    socket.data.lastMoveAt = 0;

    socket.on("world:join", async (payload, ack) => {
      try {
        const venue = await getVenueBySlug(db, payload.venueSlug);
        if (!venue) return ack({ ok: false, error: "venue_not_found" });
        const floor = await loadFloor(venue.id, payload.floorId);
        if (!floor) return ack({ ok: false, error: "invalid" });

        socket.data.venueId = venue.id;
        socket.data.floorId = floor.id;
        await socket.join([`venue:${venue.id}`, `floor:${floor.id}`]);

        let self: AvatarState | null = null;
        if (payload.visitId && payload.memberId) {
          // Only an active member of an active visit may control an avatar.
          const members = await db
            .select()
            .from(schema.visitMembers)
            .innerJoin(schema.visits, eq(schema.visits.id, schema.visitMembers.visitId))
            .where(
              and(
                eq(schema.visitMembers.visitId, payload.visitId),
                eq(schema.visits.venueId, venue.id),
                isNull(schema.visits.checkedOutAt),
                isNull(schema.visitMembers.leftAt),
              ),
            );
          const player = members.find((m) => m.visit_members.id === payload.memberId);
          if (player) {
            const controlled = [
              player.visit_members,
              ...members
                .map((m) => m.visit_members)
                .filter((m) => m.memberType === "companion" && m.followsMemberId === player.visit_members.id),
            ];
            socket.data.visitId = payload.visitId;
            socket.data.playerMemberId = player.visit_members.id;
            socket.data.memberIds = controlled.map((m) => m.id);
            const avatars = avatarsOn(floor.id);
            controlled.forEach((m, i) => {
              const state: AvatarState = {
                memberId: m.id,
                visitId: m.visitId,
                displayName: m.displayName,
                memberType: m.memberType,
                floorId: floor.id,
                x: floor.spawn.x - i * 0.8,
                y: floor.spawn.y,
                facing: "back",
                followsMemberId: m.followsMemberId,
                seatId: null,
              };
              avatars.set(m.id, state);
              socket.to(`floor:${floor.id}`).emit("avatar:joined", state);
            });
            self = avatars.get(player.visit_members.id) ?? null;
          }
        }

        const live = await getLiveSnapshot(db, venue.id);
        socket.emit("world:snapshot", {
          floorId: floor.id,
          avatars: [...avatarsOn(floor.id).values()],
          occupiedSeatIds: live.occupiedSeatIds,
        });
        socket.emit("venue:counts", { peopleInside: live.peopleInside, seatsFree: live.seatsFree, seatsTotal: live.seatsTotal });
        ack({ ok: true, floorId: floor.id, self });
      } catch (err) {
        console.error("world:join failed", err);
        ack({ ok: false, error: "invalid" });
      }
    });

    socket.on("avatar:move", ({ x, y, facing }) => {
      const { floorId, playerMemberId } = socket.data;
      if (!floorId || !playerMemberId || !Number.isFinite(x) || !Number.isFinite(y)) return;
      const now = Date.now();
      if (now - socket.data.lastMoveAt < 1000 / MOVE_RATE_LIMIT_HZ) return;
      socket.data.lastMoveAt = now;
      const floor = floorCache.get(floorId);
      if (!floor) return;
      const cx = Math.min(Math.max(x, 0), floor.width);
      const cy = Math.min(Math.max(y, 0), floor.height);
      const avatars = avatarsOn(floorId);
      if (avatars.get(playerMemberId)?.seatId) return; // stand up first
      placeAt(floorId, playerMemberId, cx, cy, { facing: facing && FACINGS.includes(facing) ? facing : undefined });
      // Companions that are not seated trail behind the player.
      socket.data.memberIds
        .filter((id) => id !== playerMemberId && !avatars.get(id)?.seatId)
        .forEach((id, i) => placeAt(floorId, id, cx - (i + 1) * 0.7, cy + 0.4));
    });

    socket.on("avatar:emote", ({ emote }) => {
      const { floorId, playerMemberId } = socket.data;
      if (!floorId || !playerMemberId || !EMOTES.includes(emote)) return;
      io.to(`floor:${floorId}`).emit("avatar:emoted", { memberId: playerMemberId, emote });
    });

    socket.on("seat:claim", async ({ assignments }, ack) => {
      const { visitId, venueId, floorId } = socket.data;
      if (!visitId || !venueId || !floorId || !Array.isArray(assignments) || assignments.length === 0) {
        return ack({ ok: false, error: "not_allowed" });
      }
      if (!assignments.every((a) => socket.data.memberIds.includes(a.memberId))) {
        return ack({ ok: false, error: "not_allowed" });
      }
      try {
        await claimSeats(db, {
          visitId,
          assignments,
          source: assignments.length > 1 ? "host" : "self",
        });
        const seatRows = await db.query.seats.findMany({
          where: (s, { inArray }) => inArray(s.id, assignments.map((a) => a.seatId)),
        });
        for (const a of assignments) {
          const seat = seatRows.find((s) => s.id === a.seatId);
          if (seat) placeAt(floorId, a.memberId, seat.x, seat.y, { seatId: seat.id });
          io.to(`floor:${floorId}`).emit("seat:updated", { seatId: a.seatId, memberId: a.memberId });
        }
        ack({ ok: true });
        await broadcastCounts(venueId);
      } catch (err) {
        if (err instanceof SeatTakenError) return ack({ ok: false, error: "seat_taken" });
        if (err instanceof VisitRuleError) return ack({ ok: false, error: "invalid" });
        console.error("seat:claim failed", err);
        ack({ ok: false, error: "invalid" });
      }
    });

    socket.on("seat:release", async ({ memberId }, ack) => {
      const { venueId, floorId } = socket.data;
      if (!venueId || !floorId || !socket.data.memberIds.includes(memberId)) return ack({ ok: false, error: "not_allowed" });
      const row = await releaseSeat(db, { memberId });
      if (row) {
        const avatar = avatarsOn(floorId).get(memberId);
        if (avatar) placeAt(floorId, memberId, avatar.x, avatar.y + 1, { seatId: null, facing: "front" });
        io.to(`floor:${floorId}`).emit("seat:updated", { seatId: row.seatId, memberId: null });
        await broadcastCounts(venueId);
      }
      ack({ ok: true });
    });

    socket.on("disconnect", () => {
      // Closing the app does not check anyone out: the visit and seats stay until
      // check-out (see DESIGN-NOTES §4). Only the moving avatar disappears.
      const { floorId } = socket.data;
      if (!floorId) return;
      const avatars = avatarsOn(floorId);
      for (const id of socket.data.memberIds) {
        if (avatars.delete(id)) io.to(`floor:${floorId}`).emit("avatar:left", { memberId: id });
      }
    });
  });

  return io;
}
