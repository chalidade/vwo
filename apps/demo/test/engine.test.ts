import { describe, expect, it } from "vitest";
import { DemoCafe } from "../src/engine";

const fixedRand = () => 0.1;

describe("DemoCafe", () => {
  it("keeps one person per seat", () => {
    const cafe = new DemoCafe(fixedRand);
    const a = cafe.checkIn("A");
    const b = cafe.checkIn("B");
    expect(cafe.claimSeats(a.visitId, [{ memberId: a.memberId, seatId: "M-01-A" }])).toEqual({ ok: true });
    expect(cafe.claimSeats(b.visitId, [{ memberId: b.memberId, seatId: "M-01-A" }])).toEqual({ ok: false, error: "seat_taken" });
  });

  it("seats a group all-or-nothing", () => {
    const cafe = new DemoCafe(fixedRand);
    const other = cafe.checkIn("X");
    cafe.claimSeats(other.visitId, [{ memberId: other.memberId, seatId: "M-01-D" }]);
    const fam = cafe.checkIn("Fam", 3);
    const ids = [fam.memberId, ...fam.companionIds];
    const res = cafe.claimSeats(fam.visitId, ids.map((memberId, i) => ({ memberId, seatId: `M-01-${"ABCD"[i]}` })));
    expect(res).toEqual({ ok: false, error: "seat_taken" });
    expect(cafe.snapshot().seatsOccupied).toBe(1);
  });

  it("moves a member instead of holding two seats, and check-out frees seats", () => {
    const cafe = new DemoCafe(fixedRand);
    const a = cafe.checkIn("A", 1);
    cafe.claimSeats(a.visitId, [{ memberId: a.memberId, seatId: "M-02-A" }]);
    cafe.claimSeats(a.visitId, [{ memberId: a.memberId, seatId: "M-02-B" }]);
    expect([...cafe.seatOwner.keys()]).toEqual(["M-02-B"]);
    cafe.checkOut(a.visitId);
    expect(cafe.snapshot()).toMatchObject({ peopleInside: 0, seatsOccupied: 0 });
  });

  it("does not let one group seat another group's member", () => {
    const cafe = new DemoCafe(fixedRand);
    const a = cafe.checkIn("A");
    const b = cafe.checkIn("B");
    expect(cafe.claimSeats(a.visitId, [{ memberId: b.memberId, seatId: "M-03-A" }])).toEqual({ ok: false, error: "invalid" });
  });

  it("bots arrive, sit down, and never share a seat", () => {
    let t = 0;
    const cafe = new DemoCafe(Math.random, () => t);
    for (let i = 0; i < 3000; i++) {
      t += 100;
      cafe.tick(100);
      const owners = [...cafe.seatOwner.values()];
      expect(new Set(owners).size).toBe(owners.length);
      for (const [seatId, memberId] of cafe.seatOwner) expect(cafe.members.get(memberId)?.seatId).toBe(seatId);
    }
    expect(cafe.events.some((e) => e.type === "seat_claim")).toBe(true);
    expect(cafe.events.some((e) => e.type === "check_out")).toBe(true);
  });
});
