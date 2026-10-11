import { describe, expect, it } from "vitest";
import { STAND_SLOTS, placeStands, planStandMove, standSlotIndex } from "../src";

const at = (id: string, floor: number, slot: number, tier = "regular") => ({ id, floor, ...STAND_SLOTS[slot]!, tier });
const where = (m: Map<string, { floor: number; x: number; y: number }>, id: string) => {
  const s = m.get(id)!;
  return [s.floor, standSlotIndex(s.x, s.y)];
};

describe("placeStands", () => {
  it("keeps booths where they were published without moves", () => {
    const m = placeStands([at("a", 0, 0), at("b", 1, 5)], undefined, 2);
    expect(where(m, "a")).toEqual([0, 0]);
    expect(where(m, "b")).toEqual([1, 5]);
  });

  it("applies the organiser's moves and leaves mini booths out", () => {
    const m = placeStands([at("a", 0, 0), at("u", 0, 0, "mini")], { a: { floor: 1, ...STAND_SLOTS[3]! } }, 2);
    expect(where(m, "a")).toEqual([1, 3]);
    expect(m.has("u")).toBe(false);
  });

  it("ignores moves to a floor that is gone or a spot that is not a slot", () => {
    const m = placeStands([at("a", 0, 2), at("b", 0, 3)], { a: { floor: 5, x: 3, y: 0.4 }, b: { floor: 0, x: 4, y: 4 } }, 2);
    expect(where(m, "a")).toEqual([0, 2]);
    expect(where(m, "b")).toEqual([0, 3]);
  });

  it("never puts two stands on one slot: a booth whose slot was taken goes to a free one", () => {
    // A stale move put "a" where "b" was booked since.
    const m = placeStands([at("a", 0, 0), at("b", 1, 0)], { a: { floor: 1, ...STAND_SLOTS[0]! } }, 2);
    expect(where(m, "a")).toEqual([1, 0]);
    expect(where(m, "b")).toEqual([1, 1]);
    // A full floor sends the bumped booth to another floor.
    const full = [0, 1, 2, 3, 4, 5].map((i) => at(`f${i}`, 0, i));
    const m2 = placeStands([...full, at("x", 1, 2)], { x: { floor: 0, ...STAND_SLOTS[2]! } }, 2);
    expect(where(m2, "x")).toEqual([0, 2]);
    expect(where(m2, "f2")).toEqual([1, 0]);
    expect(new Set([...m2.values()].map((s) => `${s.floor}:${s.x}:${s.y}`)).size).toBe(m2.size);
  });
});

describe("planStandMove", () => {
  const booths = [at("a", 0, 0), at("b", 1, 4), at("u", 0, 0, "mini")];

  it("moves a stand to a free slot on another floor", () => {
    const r = planStandMove(booths, undefined, "a", { floor: 1, slot: 2 }, 2);
    expect(r).toEqual({ placements: { a: { floor: 1, ...STAND_SLOTS[2]! } }, swapped: null });
  });

  it("swaps two stands when the slot is taken", () => {
    const r = planStandMove(booths, undefined, "a", { floor: 1, slot: 4 }, 2);
    expect(r).toEqual({ placements: { a: { floor: 1, ...STAND_SLOTS[4]! }, b: { floor: 0, ...STAND_SLOTS[0]! } }, swapped: "b" });
    // Applied, the two stands traded places and nobody else moved.
    if ("error" in r) throw new Error();
    const m = placeStands(booths, r.placements, 2);
    expect(where(m, "a")).toEqual([1, 4]);
    expect(where(m, "b")).toEqual([0, 0]);
  });

  it("refuses bad floors and slots, the same slot, unknown and mini booths", () => {
    expect(planStandMove(booths, undefined, "a", { floor: 2, slot: 0 }, 2)).toEqual({ error: "invalid_slot" });
    expect(planStandMove(booths, undefined, "a", { floor: -1, slot: 0 }, 2)).toEqual({ error: "invalid_slot" });
    expect(planStandMove(booths, undefined, "a", { floor: 0, slot: 6 }, 2)).toEqual({ error: "invalid_slot" });
    expect(planStandMove(booths, undefined, "a", { floor: 0, slot: 1.5 }, 2)).toEqual({ error: "invalid_slot" });
    expect(planStandMove(booths, undefined, "a", { floor: 0, slot: 0 }, 2)).toEqual({ error: "same_slot" });
    expect(planStandMove(booths, undefined, "zzz", { floor: 0, slot: 1 }, 2)).toEqual({ error: "not_found" });
    expect(planStandMove(booths, undefined, "u", { floor: 0, slot: 1 }, 2)).toEqual({ error: "no_stand" });
  });

  it("drops moves of booths that are no longer in the event", () => {
    const r = planStandMove(booths, { gone: { floor: 0, ...STAND_SLOTS[5]! } }, "a", { floor: 0, slot: 1 }, 2);
    expect(r).toEqual({ placements: { a: { floor: 0, ...STAND_SLOTS[1]! } }, swapped: null });
  });
});
