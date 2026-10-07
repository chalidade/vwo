// Visit lifecycle: check-in (with group companions), seat claims, leaving and check-out.
// Seat rules ("one person per seat", "one seat per person") are enforced by partial unique
// indexes in the database; this module turns those violations into SeatTakenError.
import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "./client";
import { seatOccupancies, seats, visitEvents, visitMembers, visits } from "./schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export class SeatTakenError extends Error {
  constructor(message = "Seat is already taken") {
    super(message);
    this.name = "SeatTakenError";
  }
}

export class VisitRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisitRuleError";
  }
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

function newGroupCode() {
  // 6 chars, no ambiguous letters, easy to type on a phone.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export interface CheckInInput {
  venueId: string;
  /** Null for a walk-in recorded by staff. */
  userId: string | null;
  hostName: string;
  method: "qr_entrance" | "qr_table" | "staff";
  checkinPointId?: string;
  checkedInByUserId?: string;
  /** Display names of companions (NPCs) coming with the host. */
  companions?: string[];
  floorId?: string;
}

export async function checkIn(db: Db, input: CheckInInput) {
  return db.transaction(async (tx) => {
    const [visit] = await tx
      .insert(visits)
      .values({
        venueId: input.venueId,
        userId: input.userId,
        groupCode: newGroupCode(),
        checkinMethod: input.method,
        checkinPointId: input.checkinPointId,
        checkedInByUserId: input.checkedInByUserId,
        lastHeartbeatAt: new Date(),
      })
      .returning();
    if (!visit) throw new Error("insert visit failed");

    let host;
    try {
      [host] = await tx
        .insert(visitMembers)
        .values({
          visitId: visit.id,
          venueId: input.venueId,
          userId: input.userId,
          memberType: "host",
          displayName: input.hostName,
          currentFloorId: input.floorId,
        })
        .returning();
    } catch (err) {
      if (isUniqueViolation(err)) throw new VisitRuleError("User is already checked in at this venue");
      throw err;
    }
    if (!host) throw new Error("insert host failed");

    const companions = input.companions?.length
      ? await tx
          .insert(visitMembers)
          .values(
            input.companions.map((name) => ({
              visitId: visit.id,
              venueId: input.venueId,
              memberType: "companion" as const,
              displayName: name,
              followsMemberId: host.id,
              currentFloorId: input.floorId,
            })),
          )
          .returning()
      : [];

    await tx.insert(visitEvents).values({
      visitId: visit.id,
      visitMemberId: host.id,
      venueId: input.venueId,
      type: "check_in",
      floorId: input.floorId,
      actorUserId: input.checkedInByUserId ?? input.userId,
      meta: { partySize: 1 + companions.length, method: input.method },
    });

    return { visit, host, companions };
  });
}

/** An app user joins an existing group by code, taking over a companion slot if one is given. */
export async function joinGroup(
  db: Db,
  input: { groupCode: string; userId: string; displayName: string; takeOverMemberId?: string },
) {
  return db.transaction(async (tx) => {
    const visit = await tx.query.visits.findFirst({
      where: and(eq(visits.groupCode, input.groupCode), isNull(visits.checkedOutAt)),
    });
    if (!visit) throw new VisitRuleError("Group not found or already checked out");

    try {
      if (input.takeOverMemberId) {
        const [member] = await tx
          .update(visitMembers)
          .set({ userId: input.userId, memberType: "app_user", displayName: input.displayName, followsMemberId: null })
          .where(
            and(
              eq(visitMembers.id, input.takeOverMemberId),
              eq(visitMembers.visitId, visit.id),
              eq(visitMembers.memberType, "companion"),
              isNull(visitMembers.leftAt),
            ),
          )
          .returning();
        if (!member) throw new VisitRuleError("Companion slot not available");
        await logEvent(tx, visit, member.id, "member_join", input.userId, { takeOver: true });
        return member;
      }
      const [member] = await tx
        .insert(visitMembers)
        .values({
          visitId: visit.id,
          venueId: visit.venueId,
          userId: input.userId,
          memberType: "app_user",
          displayName: input.displayName,
        })
        .returning();
      if (!member) throw new Error("insert member failed");
      await logEvent(tx, visit, member.id, "member_join", input.userId, {});
      return member;
    } catch (err) {
      if (isUniqueViolation(err)) throw new VisitRuleError("User is already checked in at this venue");
      throw err;
    }
  });
}

export interface SeatAssignment {
  memberId: string;
  seatId: string;
}

/**
 * Seat one or more members of a visit at once. All-or-nothing: if any seat is taken,
 * nothing is written and SeatTakenError is thrown. A member who is already seated is
 * moved (the old seat is released first).
 */
export async function claimSeats(
  db: Db,
  input: { visitId: string; assignments: SeatAssignment[]; actorUserId?: string; source?: "self" | "host" | "staff" },
) {
  if (input.assignments.length === 0) throw new VisitRuleError("No seats requested");
  const memberIds = input.assignments.map((a) => a.memberId);
  const seatIds = input.assignments.map((a) => a.seatId);
  if (new Set(seatIds).size !== seatIds.length) throw new VisitRuleError("Same seat requested twice");
  if (new Set(memberIds).size !== memberIds.length) throw new VisitRuleError("Same member requested twice");

  try {
    return await db.transaction(async (tx) => {
      const visit = await tx.query.visits.findFirst({
        where: and(eq(visits.id, input.visitId), isNull(visits.checkedOutAt)),
      });
      if (!visit) throw new VisitRuleError("Visit is not active");

      const members = await tx
        .select()
        .from(visitMembers)
        .where(and(inArray(visitMembers.id, memberIds), eq(visitMembers.visitId, visit.id), isNull(visitMembers.leftAt)));
      if (members.length !== memberIds.length) throw new VisitRuleError("Member is not part of this visit");

      const seatRows = await tx
        .select()
        .from(seats)
        .where(and(inArray(seats.id, seatIds), eq(seats.venueId, visit.venueId), eq(seats.isActive, true)));
      if (seatRows.length !== seatIds.length) throw new VisitRuleError("Seat not found in this venue");

      const now = new Date();
      // Moving seats: release any seat these members currently hold.
      await tx
        .update(seatOccupancies)
        .set({ endedAt: now, endReason: "stand_up" })
        .where(and(inArray(seatOccupancies.visitMemberId, memberIds), isNull(seatOccupancies.endedAt)));

      const rows = await tx
        .insert(seatOccupancies)
        .values(
          input.assignments.map((a) => ({
            seatId: a.seatId,
            visitId: visit.id,
            visitMemberId: a.memberId,
            venueId: visit.venueId,
            source: input.source ?? "self",
            startedAt: now,
          })),
        )
        .returning();

      const floorBySeat = new Map(seatRows.map((s) => [s.id, s.floorId]));
      await tx.insert(visitEvents).values(
        input.assignments.map((a) => ({
          visitId: visit.id,
          visitMemberId: a.memberId,
          venueId: visit.venueId,
          type: "seat_claim" as const,
          seatId: a.seatId,
          floorId: floorBySeat.get(a.seatId),
          actorUserId: input.actorUserId,
        })),
      );
      for (const a of input.assignments) {
        await tx
          .update(visitMembers)
          .set({ currentFloorId: floorBySeat.get(a.seatId) })
          .where(eq(visitMembers.id, a.memberId));
      }
      return rows;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new SeatTakenError();
    throw err;
  }
}

export async function releaseSeat(
  db: Db,
  input: { memberId: string; reason?: "stand_up" | "staff_clear" | "auto"; actorUserId?: string },
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(seatOccupancies)
      .set({ endedAt: new Date(), endReason: input.reason ?? "stand_up" })
      .where(and(eq(seatOccupancies.visitMemberId, input.memberId), isNull(seatOccupancies.endedAt)))
      .returning();
    if (!row) return null;
    await tx.insert(visitEvents).values({
      visitId: row.visitId,
      visitMemberId: input.memberId,
      venueId: row.venueId,
      type: "seat_release",
      seatId: row.seatId,
      actorUserId: input.actorUserId,
      meta: { reason: input.reason ?? "stand_up" },
    });
    return row;
  });
}

/** One member leaves early; the rest of the group stays. */
export async function memberLeave(db: Db, input: { memberId: string; actorUserId?: string }) {
  return db.transaction(async (tx) => {
    const member = await tx.query.visitMembers.findFirst({
      where: and(eq(visitMembers.id, input.memberId), isNull(visitMembers.leftAt)),
    });
    if (!member) throw new VisitRuleError("Member is not inside");
    if (member.memberType === "host") throw new VisitRuleError("Host leaving checks out the whole visit");
    const now = new Date();
    await tx
      .update(seatOccupancies)
      .set({ endedAt: now, endReason: "check_out" })
      .where(and(eq(seatOccupancies.visitMemberId, member.id), isNull(seatOccupancies.endedAt)));
    await tx.update(visitMembers).set({ leftAt: now }).where(eq(visitMembers.id, member.id));
    await tx.insert(visitEvents).values({
      visitId: member.visitId,
      visitMemberId: member.id,
      venueId: member.venueId,
      type: "member_leave",
      actorUserId: input.actorUserId,
    });
  });
}

export async function checkOut(
  db: Db,
  input: { visitId: string; method: "self" | "staff" | "auto_idle" | "auto_closing"; actorUserId?: string },
) {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [visit] = await tx
      .update(visits)
      .set({
        status: "checked_out",
        checkedOutAt: now,
        checkoutMethod: input.method,
        checkedOutByUserId: input.method === "staff" ? input.actorUserId : null,
      })
      .where(and(eq(visits.id, input.visitId), isNull(visits.checkedOutAt)))
      .returning();
    if (!visit) throw new VisitRuleError("Visit is not active");

    await tx
      .update(seatOccupancies)
      .set({ endedAt: now, endReason: input.method.startsWith("auto") ? "auto" : "check_out" })
      .where(and(eq(seatOccupancies.visitId, visit.id), isNull(seatOccupancies.endedAt)));
    await tx
      .update(visitMembers)
      .set({ leftAt: now })
      .where(and(eq(visitMembers.visitId, visit.id), isNull(visitMembers.leftAt)));
    await tx.insert(visitEvents).values({
      visitId: visit.id,
      venueId: visit.venueId,
      type: input.method.startsWith("auto") ? "auto_check_out" : "check_out",
      actorUserId: input.actorUserId,
      meta: { method: input.method },
    });
    return visit;
  });
}

async function logEvent(
  tx: Tx,
  visit: { id: string; venueId: string },
  memberId: string,
  type: "member_join" | "member_leave",
  actorUserId: string | undefined,
  meta: Record<string, unknown>,
) {
  await tx.insert(visitEvents).values({
    visitId: visit.id,
    visitMemberId: memberId,
    venueId: visit.venueId,
    type,
    actorUserId,
    meta,
  });
}
