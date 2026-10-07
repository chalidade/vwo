// Read model for the live "who is inside" view (DFD process 12.0).
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "./client";
import { cafeTables, floors, seatOccupancies, seats, venues, visitMembers, visits } from "./schema";

export async function getVenueBySlug(db: Db, slug: string) {
  return db.query.venues.findFirst({ where: eq(venues.slug, slug) });
}

/** Published floors with their tables and seats, for rendering the world and the editor. */
export async function getVenueLayout(db: Db, venueId: string) {
  const floorRows = await db.select().from(floors).where(eq(floors.venueId, venueId)).orderBy(asc(floors.sortOrder));
  const tableRows = await db.select().from(cafeTables).where(eq(cafeTables.venueId, venueId));
  const seatRows = await db.select().from(seats).where(eq(seats.venueId, venueId));
  return floorRows.map((floor) => ({
    ...floor,
    tables: tableRows
      .filter((t) => t.floorId === floor.id)
      .map((t) => ({ ...t, capacity: seatRows.filter((s) => s.tableId === t.id && s.isActive).length })),
    seats: seatRows.filter((s) => s.floorId === floor.id),
  }));
}

export interface LiveMember {
  memberId: string;
  visitId: string;
  displayName: string;
  memberType: "host" | "app_user" | "companion";
  floorId: string | null;
  seatId: string | null;
  seatLabel: string | null;
  checkedInAt: Date;
}

export async function getLiveSnapshot(db: Db, venueId: string) {
  const rows = await db
    .select({
      memberId: visitMembers.id,
      visitId: visitMembers.visitId,
      displayName: visitMembers.displayName,
      memberType: visitMembers.memberType,
      floorId: visitMembers.currentFloorId,
      seatId: seatOccupancies.seatId,
      seatLabel: seats.label,
      checkedInAt: visits.checkedInAt,
    })
    .from(visitMembers)
    .innerJoin(visits, eq(visits.id, visitMembers.visitId))
    .leftJoin(
      seatOccupancies,
      and(eq(seatOccupancies.visitMemberId, visitMembers.id), isNull(seatOccupancies.endedAt)),
    )
    .leftJoin(seats, eq(seats.id, seatOccupancies.seatId))
    .where(and(eq(visitMembers.venueId, venueId), isNull(visitMembers.leftAt)))
    .orderBy(asc(visits.checkedInAt));

  const members: LiveMember[] = rows;
  const totalSeats = await db
    .select({ id: seats.id })
    .from(seats)
    .where(and(eq(seats.venueId, venueId), eq(seats.isActive, true)));
  const occupied = members.filter((m) => m.seatId).length;
  return {
    peopleInside: members.length,
    groupsInside: new Set(members.map((m) => m.visitId)).size,
    seatsTotal: totalSeats.length,
    seatsOccupied: occupied,
    seatsFree: totalSeats.length - occupied,
    occupiedSeatIds: members.flatMap((m) => (m.seatId ? [m.seatId] : [])),
    members,
  };
}
