import { describe, expect, it } from "vitest";
import { canMove, coinsFor, slide, spawn } from "../src/fair/g2048";

const row = (...v: number[]) => [...v, ...Array(12).fill(0)];

describe("2048", () => {
  it("slides and merges each pair once", () => {
    expect(slide(row(2, 2, 2, 2), "left").board.slice(0, 4)).toEqual([4, 4, 0, 0]);
    expect(slide(row(2, 2, 4, 0), "right").board.slice(0, 4)).toEqual([0, 0, 4, 4]);
    expect(slide(row(4, 0, 0, 4), "left")).toMatchObject({ gained: 8, moved: true });
    expect(slide(row(2, 4, 8, 16), "left").moved).toBe(false);
    const col = Array(16).fill(0);
    col[0] = 2;
    col[12] = 2;
    expect(slide(col, "up").board[0]).toBe(4);
  });

  it("spawns into an empty cell and knows when the board is stuck", () => {
    const full = Array.from({ length: 16 }, (_, i) => (i % 2 === (Math.floor(i / 4) % 2) ? 2 : 4));
    expect(canMove(full)).toBe(false);
    expect(spawn(full)).toEqual(full);
    expect(spawn(row(2, 4, 8), () => 0).filter(Boolean)).toHaveLength(4);
  });

  it("pays for the biggest tile", () => {
    expect([64, 128, 256, 512, 1024, 2048, 4096].map(coinsFor)).toEqual([0, 2, 4, 6, 8, 10, 10]);
  });
});
