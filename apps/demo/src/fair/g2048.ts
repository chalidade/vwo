// The rules of 2048, kept apart from the screen so they can be tested.

export type Board = number[]; // 16 cells, row by row; 0 is empty
export type Dir = "left" | "right" | "up" | "down";

export const SIZE = 4;

/** The cells of each line in the order they slide toward. */
function lines(dir: Dir): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < SIZE; i++) {
    const line: number[] = [];
    for (let j = 0; j < SIZE; j++) {
      if (dir === "left") line.push(i * SIZE + j);
      else if (dir === "right") line.push(i * SIZE + (SIZE - 1 - j));
      else if (dir === "up") line.push(j * SIZE + i);
      else line.push((SIZE - 1 - j) * SIZE + i);
    }
    out.push(line);
  }
  return out;
}

/** Slide every tile one way, merging equal neighbours once. Returns the new board, the points the
 *  merges made, and whether anything moved. */
export function slide(board: Board, dir: Dir): { board: Board; gained: number; moved: boolean } {
  const next = [...board];
  let gained = 0;
  for (const line of lines(dir)) {
    const tiles = line.map((i) => board[i]!).filter(Boolean);
    const merged: number[] = [];
    for (let k = 0; k < tiles.length; k++) {
      if (tiles[k] === tiles[k + 1]) {
        merged.push(tiles[k]! * 2);
        gained += tiles[k]! * 2;
        k++;
      } else merged.push(tiles[k]!);
    }
    line.forEach((cell, k) => (next[cell] = merged[k] ?? 0));
  }
  return { board: next, gained, moved: next.some((v, i) => v !== board[i]) };
}

/** A 2 (or now and then a 4) in a random empty cell. */
export function spawn(board: Board, rand = Math.random): Board {
  const empty = board.flatMap((v, i) => (v ? [] : [i]));
  if (!empty.length) return board;
  const next = [...board];
  next[empty[Math.floor(rand() * empty.length)]!] = rand() < 0.9 ? 2 : 4;
  return next;
}

export const newBoard = (rand = Math.random) => spawn(spawn(Array(SIZE * SIZE).fill(0), rand), rand);

export const canMove = (board: Board) => (["left", "right", "up", "down"] as Dir[]).some((d) => slide(board, d).moved);

/** Coins for the biggest tile reached: 128 pays 2, doubling tiles pay 2 more, up to 10 at 2048. */
export function coinsFor(best: number) {
  if (best < 128) return 0;
  return Math.min(10, 2 * (Math.log2(best) - 6));
}

/** A numbered tile that keeps its id while it slides, so the screen can animate it. "gone" tiles
 *  slid into a merge and are drawn underneath the new one for a moment. */
export interface Tile {
  id: number;
  v: number;
  cell: number;
  state?: "new" | "merged" | "gone";
}

let tileId = 0;
const tile = (v: number, cell: number, state?: Tile["state"]): Tile => ({ id: ++tileId, v, cell, ...(state ? { state } : {}) });

export const tilesFrom = (board: Board): Tile[] => board.flatMap((v, cell) => (v ? [tile(v, cell)] : []));

export function boardOf(tiles: Tile[]): Board {
  const b: Board = Array(SIZE * SIZE).fill(0);
  for (const t of tiles) if (t.state !== "gone") b[t.cell] = t.v;
  return b;
}

/** The same move as slide(), but on tiles: each keeps its id and gets its new cell. */
export function slideTiles(tiles: Tile[], dir: Dir): { tiles: Tile[]; gained: number; moved: boolean } {
  const at = new Map<number, Tile>();
  for (const t of tiles) if (t.state !== "gone") at.set(t.cell, { ...t, state: undefined });
  const out: Tile[] = [];
  let gained = 0;
  let moved = false;
  for (const line of lines(dir)) {
    const row = line.map((c) => at.get(c)).filter((t): t is Tile => !!t);
    let k = 0;
    for (let n = 0; n < row.length; n++) {
      const a = row[n]!;
      const b = row[n + 1];
      const to = line[k++]!;
      if (b && b.v === a.v) {
        out.push({ ...a, cell: to, state: "gone" }, { ...b, cell: to, state: "gone" }, tile(a.v * 2, to, "merged"));
        gained += a.v * 2;
        moved = true;
        n++;
      } else {
        if (a.cell !== to) moved = true;
        out.push({ ...a, cell: to });
      }
    }
  }
  return { tiles: out, gained, moved };
}

/** A new 2 (or 4) in a random empty cell, marked so it can pop in. */
export function spawnTile(tiles: Tile[], rand = Math.random): Tile[] {
  const board = boardOf(tiles);
  const empty = board.flatMap((v, i) => (v ? [] : [i]));
  if (!empty.length) return tiles;
  return [...tiles, tile(rand() < 0.9 ? 2 : 4, empty[Math.floor(rand() * empty.length)]!, "new")];
}
