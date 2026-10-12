import { describe, expect, it } from "vitest";
import { BOOTH_H, DEMO_JOB_FAIR, LIFT_FRONT, boothFrame, boothSpot, fairFloorId, findPath, hallLevel, isBlocked } from "@vwo/shared";
import { BOOTH_SLOTS, DemoJobFair, type FairSaved, PLAYER_ID, recruiterId, spgHome, spgId } from "../src/jobfair-engine";

const slotOf = (b: { x: number; y: number }) => BOOTH_SLOTS.findIndex((s) => s.x === b.x && s.y === b.y);

/** Take a stand out of `floor` and hand back that floor's first free slot. */
function freeSlotOn(fair: DemoJobFair, floor: number) {
  const gone = fair.fair.booths.filter((x) => x.floor === floor && x.tier !== "mini").at(-1)!;
  fair.removeBooth(gone.id);
  return fair.freeSlots().find((s) => s.floor === floor)!;
}

describe("twelve stands per floor", () => {
  it("fits a VIP stand on every slot of every floor, each one reachable from the lift and the entrance", () => {
    const fair = new DemoJobFair(() => 0.5);
    expect(BOOTH_SLOTS).toHaveLength(12);
    // The published stands kept their places on the first six slots.
    for (const b of DEMO_JOB_FAIR.booths.filter((x) => x.tier !== "mini")) expect(slotOf(b), b.id).toBeLessThan(6);
    for (const sl of fair.freeSlots()) expect(fair.addBooth({ company: `Isi ${sl.floor} ${sl.x} ${sl.y}`, industry: "", color: "#334155", tier: "premium", ...sl })).not.toBeNull();
    expect(fair.freeSlots()).toHaveLength(0);
    // Added on the new right half, a stand stays there (a fresh fair's first save moved positions once).
    expect(fair.fair.booths.filter((b) => b.x === 88)).toHaveLength(2 * fair.fair.floors.length);
    for (const b of fair.fair.booths) if (b.tier !== "mini") fair.configureBooth(b.id, { tier: "premium" });
    fair.fair.floors.forEach((_, floor) => {
      const f = fair.floors[floor]!;
      const stands = fair.fair.booths.filter((b) => b.floor === floor && b.tier === "premium");
      expect(stands, `floor ${floor}`).toHaveLength(12);
      // Inside the hall, and no two VIP frames touch.
      for (const b of stands) {
        const fr = boothFrame(b);
        expect(fr.x, b.id).toBeGreaterThanOrEqual(0);
        expect(fr.x + fr.width, b.id).toBeLessThanOrEqual(fair.fair.width);
        for (const o of stands) if (o !== b && o.y === b.y) expect(Math.abs(boothFrame(o).x - fr.x), `${b.id} ${o.id}`).toBeGreaterThan(fr.width);
        expect(b.y + BOOTH_H).toBeLessThan(fair.fair.height);
      }
      const starts = floor === 0 ? [LIFT_FRONT, fair.fair.spawn] : [LIFT_FRONT];
      for (const from of starts)
        for (const b of stands)
          for (const spot of ["talk", "banner"] as const) {
            const to = boothSpot(b, spot);
            expect(isBlocked(f, to.x, to.y), `${b.id} ${spot}`).toBe(false);
            expect(findPath(f, from, to), `${b.id} ${spot}`).not.toBeNull();
          }
      // The VIP lounge chairs too.
      for (const st of f.seats.filter((x) => x.id.includes("-vip-"))) expect(findPath(f, LIFT_FRONT, { x: st.x, y: st.y + 0.75 }), st.id).not.toBeNull();
    });
  });
});

describe("moving stands", () => {
  it("moves a stand to a free slot on another floor, with its applicants, recruiter, promoter, SPG and floor price", () => {
    const fair = new DemoJobFair(() => 0.5);
    fair.join("Chalid", false, PLAYER_ID);
    const b = fair.fair.booths.find((x) => x.floor === 0)!;
    fair.apply(PLAYER_ID, { boothId: b.id, jobId: b.jobs[0]!.id });
    fair.configureBooth(b.id, { tier: "premium" });
    const st = fair.company.get(b.id)!;
    fair.applyShared(null, { [b.id]: { ...st, owned: [...st.owned, "promoter"] } });
    const to = freeSlotOn(fair, 2);
    const slot = slotOf(to);
    const was = { floor: b.floor, x: b.x, y: b.y };
    fair.setFloorPrice(fairFloorId(fair.fair, to.floor), 15);

    expect(fair.moveStand(b.id, to.floor, slot)).toMatchObject({ swapped: null });
    const now = fair.booth(b.id)!;
    expect([now.floor, now.x, now.y]).toEqual([to.floor, to.x, to.y]);
    // Applicants are the booth's, wherever it stands.
    expect(fair.applications.filter((a) => a.boothId === b.id)).toHaveLength(1);
    // The recruiter, the VIP SPG and the company's walking promoter are on the new floor.
    const rec = fair.staff.find((s) => s.id === recruiterId(b.id))!;
    expect(rec.floorId).toBe(fairFloorId(fair.fair, to.floor));
    expect({ x: rec.x, y: rec.y }).toEqual(boothSpot(now, "recruiter"));
    const spg = fair.staff.find((s) => s.id === spgId(b.id))!;
    expect(spg.floorId).toBe(fairFloorId(fair.fair, to.floor));
    expect({ x: spg.x, y: spg.y }).toEqual(spgHome(now));
    expect(fair.fair.promoters.find((p) => p.boothId === b.id)?.level).toBe(hallLevel(fair.fair, to.floor));
    // Getting to it takes the new floor's ticket.
    expect(fair.passFor(fair.floorIdOf(now))?.price).toBe(15);
    // The world was rebuilt: the old slot is free and walkable, the new one walled and reachable.
    expect(fair.freeSlots()).toContainEqual(was);
    expect(fair.freeSlots()).not.toContainEqual({ floor: to.floor, x: to.x, y: to.y });
    const f = fair.floors[to.floor]!;
    expect(isBlocked(f, now.x + 2.5, now.y + 2.3)).toBe(true); // the recruiter's desk
    expect(findPath(f, LIFT_FRONT, boothSpot(now, "talk"))).not.toBeNull();
    expect(isBlocked(fair.floors[was.floor]!, was.x + 2.5, was.y + 2.3)).toBe(false);
  });

  it("swaps two stands, refuses bad moves, and keeps the places across reloads", () => {
    let saved: FairSaved | null = null;
    const storage = { load: () => saved, save: (d: FairSaved) => (saved = JSON.parse(JSON.stringify(d))), clear() {} };
    const fair = new DemoJobFair(() => 0.5, undefined, undefined, storage);
    const [a, b] = [fair.fair.booths.find((x) => x.floor === 0)!, fair.fair.booths.find((x) => x.floor === 1)!];
    const pa = { floor: a.floor, x: a.x, y: a.y };
    const pb = { floor: b.floor, x: b.x, y: b.y };
    expect(fair.moveStand(a.id, b.floor, slotOf(b))).toMatchObject({ swapped: b.id });
    expect(fair.booth(a.id)).toMatchObject(pb);
    expect(fair.booth(b.id)).toMatchObject(pa);
    expect(fair.moveStand(a.id, pb.floor, slotOf(pb))).toEqual({ error: "same_slot" });
    expect(fair.moveStand(a.id, 99, 0)).toEqual({ error: "invalid_slot" });
    expect(fair.moveStand(a.id, 0, 12)).toEqual({ error: "invalid_slot" });
    fair.flush();
    const again = new DemoJobFair(() => 0.5, undefined, undefined, storage);
    expect(again.booth(a.id)).toMatchObject(pb);
    expect(again.booth(b.id)).toMatchObject(pa);
  });

  it("live: takes the places from the server, which a company's own edits can't change", () => {
    const fair = new DemoJobFair(() => 0.5);
    const b = fair.fair.booths.find((x) => x.floor === 0)!;
    const home = { floor: b.floor, x: b.x, y: b.y };
    const to = freeSlotOn(fair, 1);
    const company = { edits: { floor: 2, x: 37, y: 9.4 }, owned: [], invoices: [] };
    fair.applyShared({ removed: [], added: [] }, { [b.id]: company }, [], [], { [b.id]: to });
    expect(fair.booth(b.id)).toMatchObject(to);
    // The organiser's own setup can't carry moves: only the server's placement document does.
    fair.applyShared({ removed: [], added: [], placements: { [b.id]: { floor: 2, x: 37, y: 9.4 } } }, { [b.id]: company }, [], [], {});
    expect(fair.booth(b.id)).toMatchObject(home);
  });

  it("steps a visitor out of the way when a stand moves onto where they stand", () => {
    const fair = new DemoJobFair(() => 0.5);
    const me = fair.join("Chalid", false, PLAYER_ID);
    const to = freeSlotOn(fair, 1);
    const b = fair.fair.booths.find((x) => x.floor === 0 && x.tier !== "mini")!;
    const inside = { x: to.x + 2.5, y: to.y + 2.3 }; // where the recruiter's desk will be
    fair.placeAt(PLAYER_ID, fairFloorId(fair.fair, to.floor), inside.x, inside.y);
    fair.moveStand(b.id, to.floor, slotOf(to));
    expect(isBlocked(fair.floor(fairFloorId(fair.fair, to.floor)), inside.x, inside.y)).toBe(true);
    const v = fair.visitors.get(me.memberId)!;
    expect(isBlocked(fair.floor(v.floorId), v.x, v.y)).toBe(false);
  });
});
