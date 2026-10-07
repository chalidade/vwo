import { describe, expect, it } from "vitest";
import { isValidVenueSlug, seatPositionsAround, slugify } from "../src";

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
