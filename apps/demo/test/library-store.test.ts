import { describe, expect, it } from "vitest";
import { charsPerPage, FONT_SIZES, parsePrefs, percentRead, RECENT_MAX, rememberSpot } from "../src/fair/library-store";

describe("library prefs", () => {
  it("falls back to defaults on broken or hostile data", () => {
    expect(parsePrefs(null)).toEqual({ font: 1, theme: "sepia", books: [] });
    expect(parsePrefs("{not json")).toEqual({ font: 1, theme: "sepia", books: [] });
    const p = parsePrefs(JSON.stringify({ font: 99, theme: "neon", books: [{ id: "x" }, { id: 4507, title: "T".repeat(500), author: 3, pos: 10, pct: 250, at: 1 }] }));
    expect(p.font).toBe(1);
    expect(p.theme).toBe("sepia");
    expect(p.books).toHaveLength(1);
    expect(p.books[0]!.title).toHaveLength(200);
    expect(p.books[0]!.pct).toBe(100);
  });

  it("keeps the latest book first and the list short", () => {
    let p = parsePrefs(null);
    for (let i = 1; i <= RECENT_MAX + 3; i++) p = rememberSpot(p, { id: i, title: `B${i}`, author: "", pos: 0, pct: 1, at: i });
    p = rememberSpot(p, { id: 5, title: "B5", author: "", pos: 900, pct: 40, at: 99 });
    expect(p.books).toHaveLength(RECENT_MAX);
    expect(p.books[0]).toMatchObject({ id: 5, pos: 900 });
    expect(p.books.filter((b) => b.id === 5)).toHaveLength(1);
  });

  it("measures progress and page size sensibly", () => {
    expect(percentRead(0, 1)).toBe(100);
    expect(percentRead(0, 100)).toBe(1);
    expect(percentRead(99, 100)).toBe(100);
    const small = charsPerPage(340, 560, FONT_SIZES[4]);
    const big = charsPerPage(700, 560, FONT_SIZES[0]);
    expect(small).toBeGreaterThanOrEqual(200);
    expect(big).toBeGreaterThan(small * 3);
  });
});
