import { describe, expect, it } from "vitest";
import { parsePrefs, percentRead, RECENT_MAX, rememberSpot, ZOOMS } from "../src/fair/library-store";

describe("library prefs", () => {
  it("falls back to defaults on broken or hostile data", () => {
    expect(parsePrefs(null)).toEqual({ zoom: 0, theme: "sepia", books: [] });
    expect(parsePrefs("{not json")).toEqual({ zoom: 0, theme: "sepia", books: [] });
    const p = parsePrefs(JSON.stringify({ zoom: 99, theme: "neon", books: [{ id: "x" }, { id: 4507, title: "T".repeat(500), author: 3, pos: 10, pct: 250, at: 1 }] }));
    expect(p.zoom).toBe(0);
    expect(parsePrefs(JSON.stringify({ zoom: 2 })).zoom).toBe(2);
    expect(parsePrefs(JSON.stringify({ zoom: ZOOMS.length })).zoom).toBe(0);
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

  it("measures progress through the book's text", () => {
    expect(percentRead(0, 1000)).toBe(0);
    expect(percentRead(10, 1000)).toBe(1);
    expect(percentRead(1000, 1000)).toBe(100);
    expect(percentRead(5000, 1000)).toBe(100);
    expect(percentRead(5, 0)).toBe(100);
  });
});
