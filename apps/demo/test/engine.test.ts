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

describe("DemoCafe walking", () => {
  it("bots walk around furniture and also use the rooftop", () => {
    let t = 0;
    const cafe = new DemoCafe(Math.random, () => t);
    const ground = cafe.floors[0]!;
    let roofVisits = 0;
    for (let i = 0; i < 4000; i++) {
      t += 100;
      cafe.tick(100);
      for (const m of cafe.members.values()) {
        if (m.floorId !== ground.id) roofVisits++;
        if (m.seatId || m.memberType === "companion" || m.floorId !== ground.id) continue;
        // A walking host never stands inside a table.
        const inside = ground.tables.some((tb) => m.x > tb.x + 0.05 && m.x < tb.x + tb.width - 0.05 && m.y > tb.y + 0.05 && m.y < tb.y + tb.height - 0.05);
        expect(inside, `${m.displayName} at ${m.x},${m.y}`).toBe(false);
      }
    }
    expect(roofVisits).toBeGreaterThan(0);
  });

  it("companions follow behind the host and stand up beside their chairs", () => {
    const cafe = new DemoCafe(() => 0.1);
    const v = cafe.checkIn("Host", 2);
    for (let i = 0; i < 20; i++) cafe.move(v.memberId, 10, 12.6 - i * 0.2);
    const host = cafe.members.get(v.memberId)!;
    const [a, b] = v.companionIds.map((id) => cafe.members.get(id)!);
    expect(a!.y).toBeGreaterThan(host.y);
    expect(b!.y).toBeGreaterThan(a!.y);
    expect(Math.hypot(a!.x - host.x, a!.y - host.y)).toBeCloseTo(0.75, 1);

    cafe.claimSeats(v.visitId, [{ memberId: v.memberId, seatId: "M-01-A" }]);
    cafe.releaseSeat(v.memberId);
    const t = cafe.floors[0]!.tables[0]!;
    expect(host.y).toBeLessThan(t.y); // stepped back from the top chair, not into the table
  });
});

describe("DemoCafe orders and staff", () => {
  it("bots order at the counter and the waiter brings it to their table", () => {
    let t = 0;
    const cafe = new DemoCafe(Math.random, () => t);
    let served = 0;
    for (let i = 0; i < 3000; i++) {
      t += 100;
      cafe.tick(100);
      served = cafe.orders.filter((o) => o.status === "served").length;
      // A cup only ever sits in front of someone who is seated.
      for (const seatId of cafe.served) expect(cafe.seatOwner.has(seatId)).toBe(true);
    }
    expect(cafe.orders.length).toBeGreaterThan(0);
    expect(served).toBeGreaterThan(0);
  });

  it("only takes orders from a seated group", () => {
    let t = 0;
    const cafe = new DemoCafe(() => 0.5, () => t);
    const v = cafe.checkIn("Me");
    expect(cafe.placeOrder(v.visitId, ["Latte"])).toBeNull();
    cafe.claimSeats(v.visitId, [{ memberId: v.memberId, seatId: "M-03-A" }]);
    const order = cafe.placeOrder(v.visitId, ["Latte"], 1000)!;
    expect(order.tableLabel).toBe("M-03");
    for (let i = 0; i < 300 && order.status !== "served"; i++) {
      t += 100;
      cafe.tick(100, { maxPeople: 0 });
    }
    expect(order.status).toBe("served");
    expect(cafe.served.has("M-03-A")).toBe(true);
  });
});
