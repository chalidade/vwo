// In-browser stand-in for the database + realtime server, for the static GitHub Pages demo.
// It follows the same rules as the real backend (one person per seat, one seat per person,
// all-or-nothing group seating, companions follow their host) and fills the cafe with bots.
import { type AvatarState, type Emote, type Facing, type FloorView, buildDemoFloors, facingFor, findPath, DEMO_VENUE } from "@vwo/shared";

export interface DemoMember extends AvatarState {
  checkedInAt: number;
  isBot: boolean;
}

export interface DemoEvent {
  at: number;
  type: "check_in" | "seat_claim" | "seat_release" | "floor_change" | "check_out";
  visitId: string;
  name: string;
  seatLabel?: string;
  floorName?: string;
}

interface Bot {
  visitId: string;
  memberIds: string[];
  phase: "walking" | "seated" | "leaving";
  targets: Map<string, string>; // memberId -> seatId
  stayUntil: number;
  /** Waypoints of the current leg, on the host's floor. */
  path: { x: number; y: number }[] | null;
}

type Point = { x: number; y: number };

export type ClaimResult = { ok: true } | { ok: false; error: "seat_taken" | "invalid" };

const BOT_NAMES = ["Andi", "Sari", "Dimas", "Putri", "Bayu", "Nadia", "Raka", "Tiara", "Fajar", "Laras", "Yoga", "Maya"];
const WALK_SPEED = 2.4; // tiles per second
const FOLLOW_GAP = 0.75; // tiles between a host and each companion walking behind

export class DemoCafe {
  readonly floors: FloorView[] = buildDemoFloors();
  readonly members = new Map<string, DemoMember>();
  readonly seatOwner = new Map<string, string>();
  readonly events: DemoEvent[] = [];
  readonly emotes = new Map<string, { emote: Emote; until: number }>();
  private bots: Bot[] = [];
  private seq = 0;
  private listeners = new Set<() => void>();
  private nextBotAt = 0;
  /** Recent positions of each host, newest first, so companions can walk in their footsteps. */
  private trails = new Map<string, Point[]>();

  constructor(private readonly rand: () => number = Math.random, private now: () => number = () => Date.now()) {}

  get spawn() {
    return DEMO_VENUE.floors[0].spawn;
  }

  floor(floorId: string) {
    return this.floors.find((f) => f.id === floorId)!;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  private id(prefix: string) {
    return `${prefix}-${++this.seq}`;
  }

  seat(seatId: string) {
    for (const f of this.floors) {
      const s = f.seats.find((x) => x.id === seatId);
      if (s) return { seat: s, floor: f };
    }
    return null;
  }

  checkIn(name: string, companions = 0, isBot = false) {
    const visitId = this.id("visit");
    const hostId = this.id("member");
    const at = this.now();
    const floorId = this.floors[0]!.id;
    const make = (id: string, displayName: string, memberType: DemoMember["memberType"], i: number): DemoMember => ({
      memberId: id,
      visitId,
      displayName,
      memberType,
      floorId,
      x: this.spawn.x - i * 0.8,
      y: this.spawn.y,
      facing: "back",
      followsMemberId: memberType === "companion" ? hostId : null,
      seatId: null,
      checkedInAt: at,
      isBot,
    });
    this.members.set(hostId, make(hostId, name, "host", 0));
    const companionIds = Array.from({ length: companions }, (_, i) => {
      const id = this.id("member");
      this.members.set(id, make(id, `${name} +${i + 1}`, "companion", i + 1));
      return id;
    });
    this.events.unshift({ at, type: "check_in", visitId, name: companions ? `${name} (+${companions})` : name });
    this.emit();
    return { visitId, memberId: hostId, companionIds, groupCode: visitId.toUpperCase().replace("VISIT-", "DEMO") };
  }

  move(memberId: string, x: number, y: number, facing?: Facing) {
    const me = this.members.get(memberId);
    if (!me || me.seatId) return;
    const floor = this.floor(me.floorId);
    const nx = Math.min(Math.max(x, 0), floor.width);
    const ny = Math.min(Math.max(y, 0), floor.height);
    me.facing = facing ?? facingFor(nx - me.x, ny - me.y, me.facing);
    me.x = nx;
    me.y = ny;
    this.follow(me);
    this.emit();
  }

  /** Unseated companions walk in the host's footsteps, one gap apart. */
  private follow(host: DemoMember) {
    const trail = this.trails.get(host.memberId) ?? [];
    const head = trail[0];
    if (!head || Math.hypot(head.x - host.x, head.y - host.y) > 0.12) trail.unshift({ x: host.x, y: host.y });
    trail.length = Math.min(trail.length, 80);
    this.trails.set(host.memberId, trail);
    const followers = [...this.members.values()].filter((m) => m.followsMemberId === host.memberId && !m.seatId && m.floorId === host.floorId);
    followers.forEach((m, i) => {
      const at = pointAlong(trail, FOLLOW_GAP * (i + 1));
      if (Math.hypot(at.x - m.x, at.y - m.y) > 0.01) m.facing = facingFor(at.x - m.x, at.y - m.y, m.facing);
      m.x = at.x;
      m.y = at.y;
    });
  }

  /** Take the stairs: the member and their unseated companions arrive at (x, y) on another floor. */
  changeFloor(memberId: string, floorId: string, x: number, y: number) {
    const me = this.members.get(memberId);
    const floor = this.floors.find((f) => f.id === floorId);
    if (!me || me.seatId || !floor || me.floorId === floorId) return;
    const group = [me, ...[...this.members.values()].filter((m) => m.followsMemberId === memberId && !m.seatId)];
    for (const m of group) {
      m.floorId = floorId;
      m.x = x;
      m.y = y;
    }
    this.trails.set(memberId, [{ x, y }]);
    this.events.unshift({ at: this.now(), type: "floor_change", visitId: me.visitId, name: me.displayName, floorName: floor.name });
    this.emit();
  }

  claimSeats(visitId: string, assignments: { memberId: string; seatId: string }[]): ClaimResult {
    if (assignments.length === 0) return { ok: false, error: "invalid" };
    const seatIds = new Set(assignments.map((a) => a.seatId));
    if (seatIds.size !== assignments.length) return { ok: false, error: "invalid" };
    for (const a of assignments) {
      const m = this.members.get(a.memberId);
      if (!m || m.visitId !== visitId || !this.seat(a.seatId)) return { ok: false, error: "invalid" };
      const owner = this.seatOwner.get(a.seatId);
      // Taken by someone not in this request (members moving within the group may swap).
      if (owner && !assignments.some((x) => x.memberId === owner)) return { ok: false, error: "seat_taken" };
    }
    // All checks passed: release old seats, then take the new ones.
    for (const a of assignments) {
      const m = this.members.get(a.memberId)!;
      if (m.seatId) this.seatOwner.delete(m.seatId);
    }
    for (const a of assignments) {
      const m = this.members.get(a.memberId)!;
      const { seat, floor } = this.seat(a.seatId)!;
      this.seatOwner.set(seat.id, m.memberId);
      m.seatId = seat.id;
      m.floorId = floor.id;
      m.x = seat.x;
      m.y = seat.y;
      m.facing = "front";
      this.events.unshift({ at: this.now(), type: "seat_claim", visitId, name: m.displayName, seatLabel: seat.label });
    }
    this.emit();
    return { ok: true };
  }

  releaseSeat(memberId: string) {
    const m = this.members.get(memberId);
    if (!m?.seatId) return;
    const found = this.seat(m.seatId);
    this.seatOwner.delete(m.seatId);
    m.seatId = null;
    // Step off the chair, away from the table, so nobody ends up standing inside it.
    const table = found?.seat.tableId ? found.floor.tables.find((t) => t.id === found.seat.tableId) : undefined;
    if (table) {
      const dx = m.x - (table.x + table.width / 2);
      const dy = m.y - (table.y + table.height / 2);
      if (Math.abs(dx) / table.width > Math.abs(dy) / table.height) m.x += Math.sign(dx) * 0.5;
      else m.y += Math.sign(dy) * 0.5;
      m.facing = Math.abs(dx) / table.width > Math.abs(dy) / table.height ? (dx < 0 ? "left" : "right") : dy < 0 ? "back" : "front";
    } else m.y += 0.6;
    if (m.memberType !== "companion") {
      // Companions fall in behind from wherever they are now.
      const followers = [...this.members.values()].filter((f) => f.followsMemberId === m.memberId);
      this.trails.set(m.memberId, [{ x: m.x, y: m.y }, ...followers.map((f) => ({ x: f.x, y: f.y }))]);
    }
    this.events.unshift({ at: this.now(), type: "seat_release", visitId: m.visitId, name: m.displayName, seatLabel: found?.seat.label });
    this.emit();
  }

  checkOut(visitId: string) {
    const group = [...this.members.values()].filter((m) => m.visitId === visitId);
    if (group.length === 0) return;
    for (const m of group) {
      if (m.seatId) this.seatOwner.delete(m.seatId);
      this.members.delete(m.memberId);
    }
    this.bots = this.bots.filter((b) => b.visitId !== visitId);
    group.forEach((m) => this.trails.delete(m.memberId));
    this.events.unshift({ at: this.now(), type: "check_out", visitId, name: group.find((m) => m.memberType === "host")?.displayName ?? "?" });
    this.emit();
  }

  emote(memberId: string, emote: Emote) {
    this.emotes.set(memberId, { emote, until: this.now() + 2000 });
    this.emit();
  }

  snapshot() {
    const seatsTotal = this.floors.reduce((n, f) => n + f.seats.length, 0);
    return {
      peopleInside: this.members.size,
      groupsInside: new Set([...this.members.values()].map((m) => m.visitId)).size,
      seatsTotal,
      seatsOccupied: this.seatOwner.size,
      seatsFree: seatsTotal - this.seatOwner.size,
    };
  }

  /** Free seats at one table, for seating a whole group together. */
  freeSeatsAtBestTable(groupSize: number) {
    const candidates = this.floors.flatMap((f) =>
      f.tables
        .map((t) => f.seats.filter((s) => s.tableId === t.id && !this.seatOwner.has(s.id)))
        .filter((free) => free.length >= groupSize),
    );
    if (candidates.length === 0) return null;
    return candidates[Math.floor(this.rand() * candidates.length)]!.slice(0, groupSize);
  }

  /** Advance bots. Call from requestAnimationFrame or a timer. */
  tick(dtMs: number, opts: { maxPeople?: number } = {}) {
    const now = this.now();
    let changed = false;
    const maxPeople = opts.maxPeople ?? 14;

    if (now >= this.nextBotAt && this.members.size < maxPeople) {
      this.nextBotAt = now + 4000 + this.rand() * 6000;
      const size = 1 + Math.floor(this.rand() * 3);
      const seats = this.freeSeatsAtBestTable(size);
      if (seats) {
        const name = BOT_NAMES[Math.floor(this.rand() * BOT_NAMES.length)]!;
        const v = this.checkIn(name, size - 1, true);
        const ids = [v.memberId, ...v.companionIds];
        this.bots.push({
          visitId: v.visitId,
          memberIds: ids,
          phase: "walking",
          targets: new Map(ids.map((id, i) => [id, seats[i]!.id])),
          stayUntil: 0,
          path: null,
        });
      }
    }

    const step = (WALK_SPEED * dtMs) / 1000;
    for (const bot of [...this.bots]) {
      const host = this.members.get(bot.memberIds[0]!);
      if (!host) continue;
      if (bot.phase === "walking") {
        const target = this.seat(bot.targets.get(host.memberId)!);
        if (!target) continue;
        if (this.walkBot(bot, host, target.floor.id, target.seat, step)) {
          changed = true;
          continue;
        }
        const res = this.claimSeats(bot.visitId, [...bot.targets].map(([memberId, seatId]) => ({ memberId, seatId })));
        if (res.ok) {
          bot.phase = "seated";
          bot.stayUntil = now + 15000 + this.rand() * 25000;
          if (this.rand() < 0.5) this.emote(host.memberId, this.rand() < 0.5 ? "cheers" : "laugh");
        } else {
          // Someone took the table first: look for another one, or give up and leave.
          const seats = this.freeSeatsAtBestTable(bot.memberIds.length);
          if (seats) bot.targets = new Map(bot.memberIds.map((id, i) => [id, seats[i]!.id]));
          else bot.phase = "leaving";
        }
        bot.path = null;
        changed = true;
      } else if (bot.phase === "seated" && now >= bot.stayUntil) {
        bot.memberIds.forEach((id) => this.releaseSeat(id));
        bot.phase = "leaving";
        bot.path = null;
        changed = true;
      } else if (bot.phase === "leaving") {
        const door = { x: this.spawn.x, y: this.spawn.y + 0.3 };
        if (!this.walkBot(bot, host, this.floors[0]!.id, door, step)) this.checkOut(bot.visitId);
        changed = true;
      }
    }

    for (const [id, e] of this.emotes) {
      if (e.until <= now) {
        this.emotes.delete(id);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  /**
   * Walk a bot's host one step toward `goal` on floor `floorId`, taking the stairs when the
   * goal is on another floor. Returns false once the host has arrived.
   */
  private walkBot(bot: Bot, host: DemoMember, floorId: string, goal: Point, step: number): boolean {
    const floor = this.floor(host.floorId);
    const portal = host.floorId === floorId ? null : floor.objects?.find((o) => o.targetFloorId === floorId) ?? null;
    const legEnd = portal ? { x: portal.x + portal.width / 2, y: portal.y + portal.height / 2 } : goal;
    if (!bot.path) bot.path = findPath(floor, host, legEnd) ?? [legEnd];
    let next = bot.path[0];
    while (next && Math.hypot(next.x - host.x, next.y - host.y) < 0.05) {
      bot.path.shift();
      next = bot.path[0];
    }
    if (!next) {
      bot.path = null;
      if (!portal) return false;
      this.changeFloor(host.memberId, portal.targetFloorId!, portal.targetX ?? 1, portal.targetY ?? 1);
      return true;
    }
    const dx = next.x - host.x;
    const dy = next.y - host.y;
    const dist = Math.hypot(dx, dy);
    const d = Math.min(step, dist);
    this.move(host.memberId, host.x + (dx / dist) * d, host.y + (dy / dist) * d);
    return true;
  }
}

/** The point `distance` tiles back along a trail (newest point first). */
function pointAlong(trail: Point[], distance: number): Point {
  let left = distance;
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1]!;
    const b = trail[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg >= left) return { x: a.x + ((b.x - a.x) * left) / seg, y: a.y + ((b.y - a.y) * left) / seg };
    left -= seg;
  }
  return trail[trail.length - 1] ?? { x: 0, y: 0 };
}
