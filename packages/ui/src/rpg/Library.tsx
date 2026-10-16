"use client";
// Drawings for the Perpustakaan: its building in the park (columns, a pediment, steps up to the door,
// windows full of books) and its reading room (bookcases, the librarian's desk, a sign on the wall,
// a beanbag), and what the reading room's people have with them (an open book, a laptop).
import { LIBRARY_ROOM, LIBRARY_SHELVES, type LibraryNpc, PARK } from "@vwo/shared";
import { memo } from "react";
import type { SceneExtra } from "./CafeScene";
import { INK } from "./Furniture";

const ink = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const T = 48;
const font = "system-ui, sans-serif";
const SPINES = LIBRARY_SHELVES.map((s) => s.color);

/** A tall bookcase full of coloured spines, `w` by `h` pixels. `seed` varies the books. */
const Bookcase = /* @__PURE__ */ memo(function Bookcase({ w, h, seed, rows = 4 }: { w: number; h: number; seed: number; rows?: number }) {
  const rowH = (h - 14) / rows;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <rect x={0} y={0} width={w} height={h} rx={4} fill="#7b4a2c" {...ink} />
      {Array.from({ length: rows }, (_, r) => (
        <g key={r}>
          <rect x={7} y={7 + r * rowH} width={w - 14} height={rowH - 5} fill="#4e2e1b" />
          {Array.from({ length: Math.floor((w - 20) / 11) }, (_, i) => {
            const tall = rowH - 10 - ((i * 7 + r * 3 + seed) % 4) * 2;
            // Every so often a book leans, so the rows do not look printed.
            const lean = (i + r + seed) % 9 === 4;
            return (
              <rect
                key={i}
                x={11 + i * 11}
                y={7 + r * rowH + (rowH - 5 - tall)}
                width={9}
                height={tall}
                rx={1.5}
                fill={SPINES[(i + r * 3 + seed * 5) % SPINES.length]}
                stroke={INK}
                strokeWidth={1}
                transform={lean ? `rotate(-12 ${11 + i * 11} ${7 + r * rowH + rowH - 5})` : undefined}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
});

/** The library in the park: a small classical building with four columns, a pediment with its name,
 *  steps up to a wooden door, and windows with books in them. */
export const LibraryBuilding = /* @__PURE__ */ memo(function LibraryBuilding() {
  const L = PARK.library;
  const W = L.width * T;
  const H = (L.height + 2.4) * T;
  const ground = H - 6;
  const cx = (PARK.libraryDoor.x + PARK.libraryDoor.width / 2 - L.x) * T;
  const door = PARK.libraryDoor.width * T - 20;
  const top = 92;
  const cols = [30, 90, W - 90, W - 30];
  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={W / 2} cy={ground + 2} rx={W / 2} ry={8} fill="black" opacity={0.18} />
      {/* Pediment with the name. */}
      <path d={`M6 ${top}L${W / 2} 10L${W - 6} ${top}Z`} fill="#f5ecd7" {...ink} />
      <path d={`M40 ${top - 8}L${W / 2} 30L${W - 40} ${top - 8}Z`} fill="#e9dcbc" stroke={INK} strokeWidth={1.4} />
      <rect x={0} y={top} width={W} height={20} rx={3} fill="#d6c7a1" {...ink} />
      <text x={W / 2} y={top - 18} textAnchor="middle" fontSize={20} fontWeight={900} fill="#7c2d12" fontFamily="Georgia, serif" letterSpacing={2}>
        PERPUSTAKAAN
      </text>
      {/* The wall behind the columns, with two windows full of books. */}
      <rect x={14} y={top + 20} width={W - 28} height={ground - top - 46} fill="#efe4c8" {...ink} />
      {[60, W - 120].map((x, k) => (
        <g key={x}>
          <rect x={x} y={top + 44} width={60} height={70} rx={30} fill="#fde68a" {...ink} strokeWidth={1.8} />
          {[0, 1].map((r) => (
            <g key={r}>
              <path d={`M${x + 6} ${top + 78 + r * 24}h48`} stroke="#7b4a2c" strokeWidth={3} />
              {Array.from({ length: 6 }, (_, i) => (
                <rect key={i} x={x + 9 + i * 7} y={top + 62 + r * 24} width={5} height={16} fill={SPINES[(i + r * 2 + k * 3) % SPINES.length]} />
              ))}
            </g>
          ))}
        </g>
      ))}
      {/* The door, with a lamp either side. */}
      <rect x={cx - door / 2 - 10} y={ground - 126} width={door + 20} height={102} rx={(door + 20) / 2} fill="#d6c7a1" {...ink} />
      <rect x={cx - door / 2} y={ground - 112} width={door} height={88} rx={door / 2} fill="#92400e" {...ink} />
      <path d={`M${cx} ${ground - 112}V${ground - 24}`} stroke={INK} strokeWidth={2} />
      <circle cx={cx - 8} cy={ground - 64} r={3} fill="#fbbf24" />
      <circle cx={cx + 8} cy={ground - 64} r={3} fill="#fbbf24" />
      <rect x={cx - 34} y={ground - 150} width={68} height={18} rx={4} fill="#14532d" {...ink} strokeWidth={1.6} />
      <text x={cx} y={ground - 137} textAnchor="middle" fontSize={10} fontWeight={900} fill="#fff" fontFamily={font} letterSpacing={1}>
        BUKA
      </text>
      {/* Columns. */}
      {cols.map((x) => (
        <g key={x}>
          <rect x={x - 11} y={top + 20} width={22} height={ground - top - 48} fill="#fbf7ec" {...ink} strokeWidth={1.8} />
          <path d={`M${x - 4} ${top + 26}V${ground - 34}M${x + 4} ${top + 26}V${ground - 34}`} stroke="#d6c7a1" strokeWidth={1.6} />
          <rect x={x - 15} y={top + 18} width={30} height={8} fill="#e9dcbc" {...ink} strokeWidth={1.4} />
        </g>
      ))}
      {/* Steps. */}
      <rect x={10} y={ground - 28} width={W - 20} height={14} fill="#d6d3d1" {...ink} strokeWidth={1.8} />
      <rect x={0} y={ground - 14} width={W} height={14} fill="#e7e5e4" {...ink} strokeWidth={1.8} />
    </svg>
  );
});

/** The building as a park extra. */
export function libraryBuildingExtra(onEnter?: () => void): SceneExtra {
  const L = PARK.library;
  return {
    key: "park-library",
    x: L.x,
    y: L.y + L.height - (L.height + 2.4),
    z: L.y + L.height,
    w: L.width,
    h: L.height + 2.4,
    onClick: onEnter,
    title: onEnter ? "Masuk ke Perpustakaan" : undefined,
    node: <LibraryBuilding />,
  };
}

/** The reading room: bookcases along the back wall and down both sides, a sign on the wall over the
 *  librarian's desk, and the desk itself with a stack of books and a lamp. */
export function libraryRoomExtras(on: { books?: () => void } = {}): SceneExtra[] {
  const title = on.books ? "Pilih buku" : undefined;
  const L = LIBRARY_ROOM;
  const d = L.desk;
  const dw = d.width * T;
  const cases = [...L.backShelves.map((s) => ({ s, h: 2.6 })), ...L.sideShelves.map((s) => ({ s, h: 2.3 }))];
  return [
    ...cases.map(
      ({ s, h }, k): SceneExtra => ({
        key: `lib-case-${k}`,
        x: s.x,
        y: s.y + s.height - h,
        z: s.y + s.height,
        onClick: on.books,
        title,
        node: <Bookcase w={s.width * T} h={h * T} seed={k} />,
      }),
    ),
    {
      key: "lib-sign",
      x: d.x - 1.6,
      y: -2.2,
      z: 0.1,
      onClick: on.books,
      title,
      node: (
        <div className="fr-lounge-sign" style={{ width: (d.width + 3.2) * T, height: 1.2 * T, ["--c" as string]: "#92400e" }}>
          <b style={{ fontSize: 19 }}>📚 PERPUSTAKAAN</b>
          <span>Buku gratis · Project Gutenberg</span>
        </div>
      ),
    },
    {
      key: "lib-beanbag",
      x: L.beanbag.x - 0.1,
      y: L.beanbag.y + L.beanbag.height - 54 / T,
      // Under whoever sits in it.
      z: L.beanbag.y + 0.4,
      node: <Beanbag />,
    },
    {
      key: "lib-rug",
      x: 7.6,
      y: 4.9,
      z: 0,
      w: 10.8,
      h: 6.8,
      ground: true,
      node: <div className="lib-rug" style={{ width: 10.8 * T, height: 6.8 * T }} />,
    },
    {
      key: "lib-desk",
      x: d.x,
      y: d.y - 0.45,
      z: d.y + d.height,
      onClick: on.books,
      title,
      node: (
        <svg width={dw} height={1.3 * T} style={{ display: "block", overflow: "visible" }}>
          <rect x={0} y={12} width={dw} height={20} rx={4} fill="#e7d3b5" {...ink} />
          <rect x={4} y={32} width={dw - 8} height={1.3 * T - 32} fill="#92400e" {...ink} />
          {["#b45309", "#1e3a8a", "#0f766e"].map((c, i) => (
            <rect key={c} x={14 + (i % 2) * 3} y={6 - i * 6} width={40} height={7} rx={1.5} fill={c} {...ink} strokeWidth={1.1} />
          ))}
          <path d={`M${dw / 2 - 26} 10l26 6l26 -6v12l-26 6l-26 -6Z`} fill="#fff" {...ink} strokeWidth={1.2} />
          <path d={`M${dw / 2} 16v12`} stroke={INK} strokeWidth={1.1} />
          <path d={`M${dw - 30} 22v-22l-12 -6`} fill="none" stroke="#1f2937" strokeWidth={3} strokeLinecap="round" />
          <path d={`M${dw - 50} -10l14 -6l6 12Z`} fill="#facc15" {...ink} strokeWidth={1.1} />
          <text x={dw / 2} y={52} textAnchor="middle" fontSize={11} fontWeight={900} fill="#fff" fontFamily={font}>
            📚 PUSTAKAWAN
          </text>
        </svg>
      ),
    },
  ];
}

/** A round beanbag, slumped a little. */
const Beanbag = /* @__PURE__ */ memo(function Beanbag() {
  const w = (LIBRARY_ROOM.beanbag.width + 0.2) * T;
  return (
    <svg width={w} height={54} style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={w / 2} cy={50} rx={w / 2 - 2} ry={5} fill="black" opacity={0.18} />
      <path d={`M6 46C0 30 10 8 ${w / 2} 8S${w} 30 ${w - 6} 46C${w - 20} 54 20 54 6 46Z`} fill="#0d9488" {...ink} />
      <path d={`M16 40C20 30 ${w / 2 - 8} 24 ${w / 2} 28C${w / 2 + 8} 24 ${w - 20} 30 ${w - 16} 40`} fill="none" stroke="#134e4a" strokeWidth={1.6} opacity={0.6} />
      <ellipse cx={w / 2 - 12} cy={18} rx={9} ry={4} fill="#5eead4" opacity={0.6} />
    </svg>
  );
});

/** An open book lying on a table, a page turning every few seconds. */
function OpenBook({ seed }: { seed: number }) {
  const cover = SPINES[seed % SPINES.length];
  return (
    <svg width={34} height={18} viewBox="0 0 34 18" style={{ display: "block", overflow: "visible" }}>
      <path d="M1 4l16 2 16-2v12l-16 2-16-2Z" fill={cover} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M3 3l14 2v11L3 14Z" fill="#fffbeb" stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
      <path d="M17 5l14-2v11l-14 2Z" fill="#fffbeb" stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
      <path d="M6 7h8M6 9.5h8M6 12h6M20 7h8M20 9.5h8M20 12h6" stroke="#94a3b8" strokeWidth={0.8} />
      <path
        className="lib-page"
        d="M17 5l13-1.8v10.6L17 16Z"
        fill="#fff"
        stroke={INK}
        strokeWidth={0.8}
        strokeLinejoin="round"
        style={{ animationDelay: `-${(seed * 2.3) % 7}s` }}
      />
    </svg>
  );
}

/** A laptop seen from behind its lid, with a mug beside it. */
function Laptop() {
  return (
    <svg width={44} height={26} viewBox="0 0 44 26" style={{ display: "block", overflow: "visible" }}>
      <path d="M2 22h28l-2 3H4Z" fill="#cbd5e1" stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
      <rect x={4} y={3} width={24} height={19} rx={2} fill="#94a3b8" stroke={INK} strokeWidth={1.3} />
      <circle cx={16} cy={12} r={2.6} fill="#e2e8f0" />
      <rect className="lib-screen" x={5} y={2} width={22} height={2} rx={1} fill="#bae6fd" opacity={0.8} />
      <path d="M33 14h7v9a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2Z" fill="#f97316" stroke={INK} strokeWidth={1.1} />
      <path d="M40 16h1.5a2 2 0 0 1 0 4H40" fill="none" stroke={INK} strokeWidth={1.1} />
      <path className="lib-steam" d="M35 11q-1.5-2 0-4M38 11q1.5-2 0-4" fill="none" stroke="#cbd5e1" strokeWidth={1.1} strokeLinecap="round" />
    </svg>
  );
}

/** A picture book held open, for the child. */
function PictureBook() {
  return (
    <svg width={22} height={14} viewBox="0 0 22 14" style={{ display: "block", overflow: "visible" }}>
      <path d="M1 2l10 2 10-2v10l-10 2-10-2Z" fill="#fde047" stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
      <circle cx={6} cy={7} r={2} fill="#f97316" />
      <path d="M13 9l2.5-4 2.5 4Z" fill="#22c55e" />
    </svg>
  );
}

/** The reading table someone sits at, and whether on its far (top) side. */
function tableBy(n: LibraryNpc) {
  for (const t of LIBRARY_ROOM.tables) {
    if (n.x < t.x || n.x > t.x + t.width) continue;
    if (Math.abs(n.y - t.y) < 0.6) return { t, top: true };
    if (Math.abs(n.y - (t.y + t.height)) < 0.6) return { t, top: false };
  }
  return null;
}

/** What the reading room's people have with them: books open on the table, a laptop, a picture book. */
export function libraryNpcExtras(npcs: readonly LibraryNpc[]): SceneExtra[] {
  const out: SceneExtra[] = [];
  npcs.forEach((n, i) => {
    const at = n.seated ? tableBy(n) : null;
    if (at && (n.activity === "read" || n.activity === "laptop")) {
      const { t, top } = at;
      const y = top ? t.y + 0.12 : t.y + t.height - (n.activity === "laptop" ? 0.62 : 0.5);
      out.push({
        key: `${n.id}-prop`,
        x: n.x - (n.activity === "laptop" ? 16 : 17) / T,
        y,
        z: t.y + t.height + 0.02,
        node: n.activity === "laptop" ? <Laptop /> : <OpenBook seed={i + 2} />,
      });
    }
    if (n.activity === "kid" && n.seated) out.push({ key: `${n.id}-prop`, x: n.x - 11 / T, y: n.y - 0.62, z: n.y + 0.05, node: <PictureBook /> });
  });
  return out;
}
