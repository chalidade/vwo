"use client";
// The cafe drawn as a top-down RPG room (in the spirit of Pokémon interiors and the walkable town
// on chalidade.github.io/tools): wood floor, back wall with windows and a chalk menu, the cashier
// counter with its barista, tables and chairs, plants, stairs, and chibi characters that face the
// way they walk and sit down on real chairs. Depth comes from sorting everything by its base y.
//
// Coordinates in props are tiles (the same units as the database layout). The scene either
// follows a point with a camera (the customer's world) or fits the whole floor (the admin view).
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AvatarState, Facing, FloorView, SeatView, TableView } from "@vwo/shared";
import {
  Barista,
  ChairSprite,
  type ChairSide,
  CounterSprite,
  IndoorWall,
  LampSprite,
  PlantSprite,
  RooftopEdge,
  RugSprite,
  ShelfSprite,
  SofaSprite,
  StairsSprite,
  StoolSprite,
  TableSprite,
} from "./Furniture";
import { type Look, Person, lookFor } from "./Person";

/** Pixels per tile. */
export const TILE = 48;
const EDGE = 14;

function wallTiles(floor: FloorView) {
  return floor.theme === "rooftop" ? 2.2 : 2.6;
}

/** Which side of its table a chair stands on. Chairs without a table count as "n". */
export function chairSide(seat: SeatView, table: TableView | undefined): ChairSide {
  if (!table) return "n";
  const dx = seat.x - (table.x + table.width / 2);
  const dy = seat.y - (table.y + table.height / 2);
  if (Math.abs(dx) / table.width > Math.abs(dy) / table.height) return dx < 0 ? "w" : "e";
  return dy < 0 ? "n" : "s";
}

/** A seated person faces their table. */
export function seatFacing(seat: SeatView, table: TableView | undefined): Facing {
  return ({ n: "front", s: "back", w: "right", e: "left" } as const)[chairSide(seat, table)];
}

/** Where to stand to talk to the barista: in front of the counter, if this floor has one. */
export function counterFront(floor: FloorView) {
  const c = floor.objects?.find((o) => o.type === "counter");
  return c ? { x: c.x + c.width / 2, y: c.y + c.height + 0.6 } : null;
}

const DIR: Record<Facing, string> = { front: "down", back: "up", left: "side", right: "side" };

export interface CafeSceneProps {
  floor: FloorView;
  /** Name of another floor, for stair signs. */
  floorName?: (floorId: string) => string;
  occupiedSeatIds: Set<string>;
  avatars?: AvatarState[];
  lookOf?: (avatar: AvatarState) => Look;
  selfMemberId?: string | null;
  emotes?: Record<string, string>;
  /** Tile the camera follows. Without it the whole floor is fitted into view. */
  follow?: { x: number; y: number } | null;
  showFreeSeats?: boolean;
  /** A seat within reach: gets a bouncing arrow. */
  highlightSeatId?: string | null;
  onSeatClick?: (seatId: string) => void;
  onTileClick?: (x: number, y: number) => void;
  onAvatarClick?: (memberId: string) => void;
  onBaristaClick?: () => void;
  className?: string;
  style?: CSSProperties;
  /** HUD drawn over the scene. */
  children?: ReactNode;
}

interface Ent {
  key: string;
  z: number;
  x: number;
  y: number;
  node: ReactNode;
  onClick?: () => void;
  title?: string;
}

export function CafeScene({
  floor,
  floorName = () => "Tangga",
  occupiedSeatIds,
  avatars = [],
  lookOf = (a) => lookFor(`${a.displayName}:${a.memberId}`),
  selfMemberId,
  emotes = {},
  follow,
  showFreeSeats = false,
  highlightSeatId,
  onSeatClick,
  onTileClick,
  onAvatarClick,
  onBaristaClick,
  className,
  style,
  children,
}: CafeSceneProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ w: 800, h: 560 });
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setView({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const wall = wallTiles(floor) * TILE;
  const ox = EDGE;
  const oy = wall;
  const worldW = floor.width * TILE + EDGE * 2;
  const worldH = wall + floor.height * TILE + EDGE;
  const px = (x: number) => ox + x * TILE;
  const py = (y: number) => oy + y * TILE;

  // --- Camera.
  let scale: number;
  let camX: number;
  let camY: number;
  const cam = useRef<{ x: number; y: number; floor: string; at: number } | null>(null);
  if (follow) {
    scale = view.w < 640 ? Math.min(1, Math.max(0.72, view.h / worldH)) : 1;
    const vw = view.w / scale;
    const vh = view.h / scale;
    const fit = (pos: number, v: number, size: number) => (size <= v ? (size - v) / 2 : Math.min(Math.max(pos - v / 2, 0), size - v));
    const tx = fit(px(follow.x), vw, worldW);
    const ty = fit(py(follow.y) - 20, vh, worldH);
    // Ease toward the target while rendering every frame; snap after a pause or a floor change.
    const prev = cam.current;
    const t = performance.now();
    const dt = prev ? (t - prev.at) / 1000 : Infinity;
    const k = !prev || prev.floor !== floor.id || dt > 0.25 ? 1 : 1 - Math.exp(-dt * 9);
    camX = prev && k < 1 ? prev.x + (tx - prev.x) * k : tx;
    camY = prev && k < 1 ? prev.y + (ty - prev.y) * k : ty;
    cam.current = { x: camX, y: camY, floor: floor.id, at: t };
  } else {
    scale = Math.min(view.w / worldW, view.h / worldH, 1.25);
    camX = -(view.w / scale - worldW) / 2;
    camY = -(view.h / scale - worldH) / 2;
    cam.current = null;
  }

  // --- Who is walking: anyone whose position changed in the last moment.
  const motion = useRef(new Map<string, { x: number; y: number; at: number }>());
  const now = performance.now();
  const walking = new Set<string>();
  for (const a of avatars) {
    const m = motion.current.get(a.memberId);
    if (!m || Math.abs(m.x - a.x) > 0.001 || Math.abs(m.y - a.y) > 0.001) {
      motion.current.set(a.memberId, { x: a.x, y: a.y, at: m ? now : 0 });
      if (m) walking.add(a.memberId);
    } else if (now - m.at < 180) walking.add(a.memberId);
  }
  // Re-render once more after people stop, so their legs stop too.
  const [, settle] = useState(0);
  useEffect(() => {
    if (walking.size === 0) return;
    const id = setTimeout(() => settle((n) => n + 1), 200);
    return () => clearTimeout(id);
  });

  const tables = new Map(floor.tables.map((t) => [t.id, t]));
  const ents: Ent[] = [];
  const ground: Ent[] = [];

  // --- Map objects.
  for (const o of floor.objects ?? []) {
    const w = o.width * TILE;
    const h = o.height * TILE;
    if (o.type === "counter") {
      ents.push({ key: o.id, z: py(o.y + o.height), x: px(o.x), y: py(o.y), node: <CounterSprite w={w} h={h} /> });
      ents.push({
        key: `${o.id}-barista`,
        z: py(o.y) - 1,
        x: px(o.x + o.width * 0.3) - 22,
        y: py(o.y - 0.12) - 58,
        node: <Barista />,
        onClick: onBaristaClick,
        title: "Barista",
      });
    } else if (o.type === "stairs" || o.type === "elevator") {
      const up = floor.theme !== "rooftop";
      ground.push({
        key: o.id,
        z: 1,
        x: px(o.x),
        y: py(o.y),
        node: <StairsSprite w={w} h={h} up={up} label={o.targetFloorId ? floorName(o.targetFloorId) : ""} />,
      });
    } else if (o.type === "decor") {
      const base = py(o.y + o.height);
      const cx = px(o.x + o.width / 2);
      switch (o.spriteKey) {
        case "rug":
          ground.push({ key: o.id, z: 0, x: px(o.x), y: py(o.y), node: <RugSprite w={w} h={h} /> });
          break;
        case "plant":
          ents.push({ key: o.id, z: base, x: cx - 23, y: base - 56, node: <PlantSprite /> });
          break;
        case "plant-big":
          ents.push({ key: o.id, z: base, x: cx - 30, y: base - 90, node: <PlantSprite big /> });
          break;
        case "shelf":
          ents.push({ key: o.id, z: base, x: px(o.x), y: py(o.y) - 54, node: <ShelfSprite w={w} h={h} /> });
          break;
        case "sofa":
          ents.push({ key: o.id, z: base, x: px(o.x), y: py(o.y), node: <SofaSprite w={w} h={h} /> });
          break;
        case "lamp":
          ents.push({ key: o.id, z: base, x: cx - 20, y: base - 94, node: <LampSprite /> });
          break;
        default:
          ents.push({ key: o.id, z: base, x: cx - 23, y: base - 56, node: <PlantSprite /> });
      }
    } else if (o.type === "wall" || o.type === "blocked") {
      ents.push({ key: o.id, z: py(o.y + o.height), x: px(o.x), y: py(o.y), node: <div className="rpg-wall-edge" style={{ width: w, height: h, borderRadius: 4 }} /> });
    }
  }

  // --- Tables, with a cup in front of everyone sitting at them.
  for (const t of floor.tables) {
    const inset = t.shape === "bar" ? 0.22 : 0.38;
    const cups = floor.seats
      .filter((s) => s.tableId === t.id && occupiedSeatIds.has(s.id))
      .map((s) => ({
        x: (Math.min(Math.max(s.x, t.x + inset), t.x + t.width - inset) - t.x) * TILE,
        y: (Math.min(Math.max(s.y, t.y + inset), t.y + t.height - inset) - t.y) * TILE,
      }));
    ents.push({
      key: t.id,
      z: py(t.y + t.height),
      x: px(t.x),
      y: py(t.y),
      node: <TableSprite shape={t.shape} w={t.width * TILE} h={t.height * TILE} cups={cups} label={t.label} />,
    });
  }

  // --- Chairs.
  for (const s of floor.seats) {
    if (!s.isActive) continue;
    const table = s.tableId ? tables.get(s.tableId) : undefined;
    const side = chairSide(s, table);
    const free = !occupiedSeatIds.has(s.id);
    const x = px(s.x) - 22;
    const y = py(s.y) - 32;
    const click = free && onSeatClick ? () => onSeatClick(s.id) : undefined;
    const title = `${s.label} · ${free ? "kosong" : "terisi"}`;
    if (table?.shape === "bar") ents.push({ key: s.id, z: py(s.y) - 2, x, y, node: <StoolSprite />, onClick: click, title });
    else {
      ents.push({ key: s.id, z: py(s.y) - 2, x, y, node: <ChairSprite side={side} part={side === "s" ? "seat" : "all"} />, onClick: click, title });
      if (side === "s") ents.push({ key: `${s.id}-back`, z: py(s.y) + 2, x, y, node: <ChairSprite side="s" part="back" /> });
    }
    if (showFreeSeats && free) ground.push({ key: `${s.id}-ring`, z: 2, x: px(s.x) - 20, y: py(s.y) - 14, node: <div className="rpg-seat-ring" style={{ width: 40, height: 28 }} /> });
    if (highlightSeatId === s.id) ents.push({ key: `${s.id}-arrow`, z: 1e6, x: px(s.x) - 9, y: py(s.y) - 52, node: <div className="rpg-arrow" /> });
  }

  // --- Characters.
  for (const a of avatars) {
    if (a.floorId !== floor.id) continue;
    const seat = a.seatId ? floor.seats.find((s) => s.id === a.seatId) : undefined;
    const table = seat?.tableId ? tables.get(seat.tableId) : undefined;
    const facing = seat ? seatFacing(seat, table) : a.facing;
    const self = a.memberId === selfMemberId;
    const npc = a.memberType === "companion";
    const emote = emotes[a.memberId];
    ents.push({
      key: a.memberId,
      z: py(a.y) + (seat ? 1 : 0),
      x: px(a.x) - 22,
      y: py(a.y) - (seat ? 50 : 58),
      onClick: onAvatarClick ? () => onAvatarClick(a.memberId) : undefined,
      title: a.displayName,
      node: (
        <div
          className="rpg-sprite"
          data-dir={DIR[facing]}
          data-walking={walking.has(a.memberId) && !seat ? "" : undefined}
          data-seated={seat ? "" : undefined}
          data-clickable={onAvatarClick ? "" : undefined}
        >
          {!seat && <div className="rpg-shadow" />}
          <div className="pg-flip" style={{ transform: `scaleX(${facing === "left" ? -1 : 1})` }}>
            <Person look={lookOf(a)} />
          </div>
          {(self || !npc) && (
            <div className="rpg-name" data-self={self ? "" : undefined} data-npc={npc ? "" : undefined}>
              {a.displayName}
            </div>
          )}
          {emote && <div className="rpg-emote">{emote}</div>}
        </div>
      ),
    });
  }

  ents.sort((a, b) => a.z - b.z);

  const doors = (floor.objects ?? []).filter((o) => o.type === "door");
  const menuAt = (() => {
    const c = floor.objects?.find((o) => o.type === "counter");
    return c ? px(c.x + c.width / 2) : null;
  })();
  const windows: number[] = [];
  if (floor.theme !== "rooftop") {
    const tall = (floor.objects ?? []).filter((o) => o.y < 1.5 && o.spriteKey !== "rug" && o.type !== "spawn_point");
    for (let x = 2.5; x < floor.width - 1; x += 3.6) {
      if (!tall.some((o) => x > o.x - 1.2 && x < o.x + o.width + 1.2)) windows.push(px(x));
    }
  }

  const toTile = (clientX: number, clientY: number) => {
    const r = viewportRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / scale + camX - ox) / TILE, y: ((clientY - r.top) / scale + camY - oy) / TILE };
  };

  const edgeColor = floor.theme === "rooftop" ? "#9ca3af" : undefined;

  return (
    <div
      ref={viewportRef}
      className={`rpg-viewport${className ? ` ${className}` : ""}`}
      style={style}
      onPointerDown={(e) => {
        if (!onTileClick || (e.target as HTMLElement).closest("[data-hit]")) return;
        const t = toTile(e.clientX, e.clientY);
        if (t.x >= 0 && t.y >= 0 && t.x <= floor.width && t.y <= floor.height) onTileClick(t.x, t.y);
      }}
    >
      <div
        className="rpg-world"
        style={{ width: worldW, height: worldH, transform: `translate3d(${-camX * scale}px, ${-camY * scale}px, 0) scale(${scale})` }}
        aria-hidden
      >
        {floor.theme === "rooftop" ? <RooftopEdge w={worldW} h={wall} /> : <IndoorWall w={worldW} h={wall} menuAt={menuAt} windows={windows} />}
        <div
          className={floor.theme === "rooftop" ? "rpg-floor-deck" : "rpg-floor-wood"}
          style={{ position: "absolute", left: ox, top: oy, width: floor.width * TILE, height: floor.height * TILE }}
        />
        <div style={{ position: "absolute", left: ox, top: oy, width: floor.width * TILE, height: 14, background: "linear-gradient(rgb(0 0 0 / 0.28), transparent)" }} />
        <div className="rpg-wall-edge" style={{ position: "absolute", left: 0, top: oy - (floor.theme === "rooftop" ? 0 : 0), width: EDGE, height: worldH - oy, background: edgeColor }} />
        <div className="rpg-wall-edge" style={{ position: "absolute", right: 0, top: oy, width: EDGE, height: worldH - oy, background: edgeColor }} />
        <div className="rpg-wall-edge" style={{ position: "absolute", left: 0, bottom: 0, width: worldW, height: EDGE, background: edgeColor }} />
        {doors.map((d) => (
          <div key={d.id} style={{ position: "absolute", left: px(d.x), top: worldH - EDGE, width: d.width * TILE, height: EDGE, background: "#fef3c7", boxShadow: "inset 0 4px 0 rgb(0 0 0 / 0.25)" }} />
        ))}

        {ground.map((e) => (
          <div key={e.key} className="rpg-ent" style={{ transform: `translate(${e.x}px, ${e.y}px)`, zIndex: e.z }}>
            {e.node}
          </div>
        ))}
        {ents.map((e) => (
          <div
            key={e.key}
            className="rpg-ent"
            data-hit={e.onClick ? "" : undefined}
            title={e.title}
            onPointerDown={e.onClick ? (ev) => ev.stopPropagation() : undefined}
            onClick={e.onClick}
            style={{ transform: `translate(${e.x}px, ${e.y}px)`, zIndex: 10 + Math.round(e.z), cursor: e.onClick ? "pointer" : undefined }}
          >
            {e.node}
          </div>
        ))}
      </div>
      <div className="rpg-vignette" />
      {children}
    </div>
  );
}
