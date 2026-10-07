// In-browser stand-in for the database + realtime server, for the static GitHub Pages demo.
// It follows the same rules as the real backend (one person per seat, one seat per person,
// all-or-nothing group seating, companions follow their host) and fills the cafe with bots.
import { type AvatarState, type Emote, type Facing, type FloorView, buildDemoFloors, facingFor, DEMO_VENUE } from "@vwo/shared";

export interface DemoMember extends AvatarState {
  checkedInAt: number;
  isBot: boolean;
}

export interface DemoEvent {
  at: number;
  type: "check_in" | "seat_claim" | "seat_release" | "check_out";
  visitId: string;
  name: string;
  seatLabel?: string;
}

interface Bot {
  visitId: string;
  memberIds: string[];
  phase: "walking" | "seated" | "leaving";
  targets: Map<string, string>; // memberId -> seatId
  stayUntil: number;
}

export type ClaimResult = { ok: true } | { ok: false; error: "seat_taken" | "invalid" };

const BOT_NAMES = ["Andi", "Sari", "Dimas", "Putri", "Bayu", "Nadia", "Raka", "Tiara", "Fajar", "Laras", "Yoga", "Maya"];
const WALK_SPEED = 3; // tiles per second

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

  constructor(private readonly rand: () => number = Math.random, private now: () => number = () => Date.now()) {}

  get spawn() {
    return DEMO_VENUE.floors[0].spawn;
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
    const floor = this.floors.find((f) => f.id === me.floorId)!;
    const nx = Math.min(Math.max(x, 0), floor.width);
    const ny = Math.min(Math.max(y, 0), floor.height);
    me.facing = facing ?? facingFor(nx - me.x, ny - me.y, me.facing);
    me.x = nx;
    me.y = ny;
    // Unseated companions trail behind their host.
    [...this.members.values()]
      .filter((m) => m.followsMemberId === memberId && !m.seatId)
      .forEach((m, i) => {
        m.facing = me.facing;
        m.x = nx - (i + 1) * 0.7;
        m.y = ny + 0.4;
      });
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
    const label = this.seat(m.seatId)?.seat.label;
    this.seatOwner.delete(m.seatId);
    m.seatId = null;
    m.y += 1;
    this.events.unshift({ at: this.now(), type: "seat_release", visitId: m.visitId, name: m.displayName, seatLabel: label });
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
        });
      }
    }

    const step = (WALK_SPEED * dtMs) / 1000;
    for (const bot of [...this.bots]) {
      if (bot.phase === "walking") {
        const host = this.members.get(bot.memberIds[0]!);
        const target = this.seat(bot.targets.get(bot.memberIds[0]!)!);
        if (!host || !target) continue;
        const dx = target.seat.x - host.x;
        const dy = target.seat.y - host.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.3) {
          this.move(host.memberId, host.x + (dx / dist) * Math.min(step, dist), host.y + (dy / dist) * Math.min(step, dist));
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
        changed = true;
      } else if (bot.phase === "seated" && now >= bot.stayUntil) {
        bot.memberIds.forEach((id) => this.releaseSeat(id));
        bot.phase = "leaving";
        changed = true;
      } else if (bot.phase === "leaving") {
        const host = this.members.get(bot.memberIds[0]!);
        if (!host) continue;
        const dx = this.spawn.x - host.x;
        const dy = this.spawn.y + 1.5 - host.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.3) this.move(host.memberId, host.x + (dx / dist) * Math.min(step, dist), host.y + (dy / dist) * Math.min(step, dist));
        else this.checkOut(bot.visitId);
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
}
