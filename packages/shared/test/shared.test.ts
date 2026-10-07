import { describe, expect, it } from "vitest";
import { DEMO_VENUE, buildDemoFloors, findPath, isBlocked, isValidVenueSlug, portalAt, seatPositionsAround, slide, slugify } from "../src";

describe("venue slug", () => {
  it("accepts lowercase slugs and rejects reserved or malformed ones", () => {
    expect(isValidVenueSlug("cafe-a")).toBe(true);
    expect(isValidVenueSlug("admin")).toBe(false);
    expect(isValidVenueSlug("Cafe A")).toBe(false);
    expect(isValidVenueSlug("ab")).toBe(false);
    expect(isValidVenueSlug("-cafe")).toBe(false);
  });

  it("slugifies display names", () => {
    expect(slugify("Kopi Kenangan Senayan!")).toBe("kopi-kenangan-senayan");
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
  });
});

describe("seatPositionsAround", () => {
  it("creates one seat per capacity, none overlapping the table", () => {
    const table = { x: 4, y: 4, width: 2, height: 2, shape: "square" as const };
    const pts = seatPositionsAround(table, 4);
    expect(pts).toHaveLength(4);
    for (const p of pts) {
      const inside = p.x > table.x && p.x < table.x + table.width && p.y > table.y && p.y < table.y + table.height;
      expect(inside).toBe(false);
    }
  });

  it("lines bar stools up below the bar", () => {
    const pts = seatPositionsAround({ x: 0, y: 0, width: 6, height: 1, shape: "bar" }, 3);
    expect(pts.map((p) => p.y)).toEqual([1.6, 1.6, 1.6]);
    expect(pts.map((p) => p.x)).toEqual([1, 3, 5]);
  });

  it("returns nothing for zero capacity", () => {
    expect(seatPositionsAround({ x: 0, y: 0, width: 1, height: 1, shape: "round" }, 0)).toEqual([]);
  });
});

describe("facingFor", () => {
  it("picks one of four sprite directions from movement", async () => {
    const { facingFor } = await import("../src");
    expect(facingFor(1, 0)).toBe("right");
    expect(facingFor(-1, 0.2)).toBe("left");
    expect(facingFor(0, 1)).toBe("front");
    expect(facingFor(0.1, -1)).toBe("back");
    expect(facingFor(0, 0, "left")).toBe("left");
  });
});

describe("walking", () => {
  const floors = buildDemoFloors();
  const ground = floors[0]!;

  it("finds a path from the door to every seat without crossing furniture", () => {
    const spawn = DEMO_VENUE.floors[0].spawn;
    for (const seat of ground.seats) {
      const path = findPath(ground, spawn, seat);
      expect(path, seat.label).not.toBeNull();
      // Every waypoint except the chair itself is clear of tables and objects.
      for (const p of path!.slice(0, -1)) expect(isBlocked(ground, p.x, p.y, 0.2), `${seat.label} ${p.x},${p.y}`).toBe(false);
    }
  });

  it("slides along a table instead of walking through it", () => {
    const t = ground.tables[0]!;
    const above = { x: t.x + 0.2, y: t.y - 0.5 };
    const moved = slide(ground, above.x, above.y, 0.3, 0.5);
    expect(moved.y).toBe(above.y);
    expect(moved.x).toBeCloseTo(above.x + 0.3);
  });

  it("links the floors by stairs", () => {
    const stairs = ground.objects!.find((o) => o.type === "stairs")!;
    expect(portalAt(ground, stairs.x + 0.5, stairs.y + 0.5)?.targetFloorId).toBe(floors[1]!.id);
    expect(portalAt(ground, 10, 12)).toBeNull();
  });
});
