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

export interface DemoOrder {
  id: string;
  visitId: string;
  /** Who ordered (the group's host). */
  name: string;
  items: string[];
  tableLabel: string;
  status: "new" | "ready" | "delivering" | "served" | "cancelled";
  at: number;
  readyAt: number;
}

/** Staff walking the floor. Not customers: no seat, not counted as people inside. */
export interface DemoStaff {
  id: string;
  name: string;
  role: "waiter";
  floorId: string;
  x: number;
  y: number;
  facing: Facing;
  carrying: boolean;
}

interface WaiterTask {
  orderId: string;
  phase: "pickup" | "deliver" | "return";
  path: Point[] | null;
}

interface Bot {
  visitId: string;
  memberIds: string[];
  phase: "to_counter" | "ordering" | "walking" | "seated" | "leaving";
  /** What the group will order at the counter. */
  wants: string[];
  orderedUntil: number;
  nextChatAt: number;
  targets: Map<string, string>; // memberId -> seatId
  stayUntil: number;
  /** Waypoints of the current leg, on the host's floor. */
  path: { x: number; y: number }[] | null;
}

type Point = { x: number; y: number };

export type ClaimResult = { ok: true } | { ok: false; error: "seat_taken" | "invalid" };

const DRINKS = ["Kopi Susu Gula Aren", "Americano", "Latte", "Matcha Latte", "Caramel Macchiato", "Black Orange", "Thai Tea Latte", "Chocolate", "Croissant", "Lemon Tea"];
const CHATS: [string, string][] = [
  ["Kopinya enak banget!", "Iya, manisnya pas."],
  ["Habis ini mau ke mana?", "Pulang aja, capek hehe."],
  ["Wifi-nya kenceng ya", "Lumayan buat kerja."],
  ["Coba deh croissant-nya", "Nanti aku pesan juga!"],
  ["Tempatnya cozy ya", "Betul, betah di sini."],
  ["Lagi sibuk apa sekarang?", "Biasa, kerjaan numpuk."],
  ["Lagunya enak nih", "Playlist-nya bagus!"],
  ["Foto dulu yuk", "Ayo! 📸"],
];
const SOLO_LINES = ["Hmm, enak.", "Akhirnya ngopi juga ☕", "Nyaman banget di sini", "Lanjut kerja dulu..."];
const THANKS = ["Terima kasih!", "Makasih, Kak!", "Wah, cepat!", "Asyik, datang juga!"];
const BARISTA_IDLE = ["Kopi susu gula aren lagi favorit hari ini!", "Ada croissant baru keluar oven!", "Selamat datang di Cafe A ☕"];
const WAITER_SPEED = 2.8;

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
  /** Speech bubbles by member id, staff id, or "barista". */
  readonly bubbles = new Map<string, { text: string; until: number }>();
  readonly orders: DemoOrder[] = [];
  /** Seats whose order has arrived: they get a cup on the table. */
  readonly served = new Set<string>();
  readonly staff: DemoStaff[];
  private waiterTask: WaiterTask | null = null;
  private later: { at: number; fn: () => void }[] = [];
  private nextBaristaLineAt = 0;

  constructor(private readonly rand: () => number = Math.random, private now: () => number = () => Date.now()) {
    const home = this.waiterHome;
    this.staff = [{ id: "staff-waiter", name: "Rina", role: "waiter", floorId: this.floors[0]!.id, x: home.x, y: home.y, facing: "front", carrying: false }];
    this.nextBaristaLineAt = this.now() + 8000;
  }

  private get counter() {
    return this.floors[0]!.objects!.find((o) => o.type === "counter")!;
  }

  /** Where the waiter waits: just past the end of the counter. */
  get waiterHome() {
    const c = this.counter;
    return { x: c.x + c.width + 0.7, y: c.y + c.height + 0.4 };
  }

  /** Where customers stand to order, and where the waiter picks orders up. */
  counterSpot(slot = 0) {
    const c = this.counter;
    return { x: c.x + 1.4 + slot * 0.9, y: c.y + c.height + 0.7 };
  }

  say(id: string, text: string, ms = 2600) {
    this.bubbles.set(id, { text, until: this.now() + ms });
    this.emit();
  }

  private after(ms: number, fn: () => void) {
    this.later.push({ at: this.now() + ms, fn });
  }

  private pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.rand() * list.length)]!;
  }

  /**
   * An order goes to the cashier; the barista makes it and the waiter brings it to the table.
   * Someone from the group must be seated so the waiter knows where to go.
   */
  placeOrder(visitId: string, items: string[], prepMs = 4000 + this.rand() * 4000) {
    const group = [...this.members.values()].filter((m) => m.visitId === visitId);
    const seated = group.find((m) => m.seatId);
    if (!seated || items.length === 0) return null;
    const host = group.find((m) => m.memberType === "host") ?? seated;
    const table = this.seat(seated.seatId!)?.seat.tableId ?? "";
    const order: DemoOrder = { id: this.id("order"), visitId, name: host.displayName, items, tableLabel: table, status: "new", at: this.now(), readyAt: this.now() + prepMs };
    this.orders.unshift(order);
    this.say("barista", `Siap, ${items[0]}${items.length > 1 ? ` +${items.length - 1}` : ""} segera dibuat!`);
    return order;
  }

  get spawn() {
    return DEMO_VENUE.floors[0].spawn;
  }

  floor(floorId: string) {
    return this.floors.find((f) => f.id === floorId)!;
  }

  /** Whether any screen is showing this right now; nobody watching, nobody needs it to move. */
  get watched() {
    return this.listeners.size > 0;
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
    this.served.delete(m.seatId);
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
    group.forEach((m) => {
      this.trails.delete(m.memberId);
      this.bubbles.delete(m.memberId);
      if (m.seatId) this.served.delete(m.seatId);
    });
    for (const o of this.orders) if (o.visitId === visitId && o.status !== "served") o.status = "cancelled";
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
          phase: "to_counter",
          wants: Array.from({ length: size }, () => this.pick(DRINKS)),
          orderedUntil: 0,
          nextChatAt: 0,
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
      if (bot.phase === "to_counter") {
        const spot = this.counterSpot(this.bots.indexOf(bot) % 3);
        if (this.walkBot(bot, host, this.floors[0]!.id, spot, step)) {
          changed = true;
          continue;
        }
        host.facing = "back";
        bot.phase = "ordering";
        bot.orderedUntil = now + 2600;
        this.say("barista", `Halo ${host.displayName}! Mau pesan apa?`, 1800);
        this.after(1100, () => this.members.has(host.memberId) && this.say(host.memberId, `${bot.wants[0]}${bot.wants.length > 1 ? ` sama ${bot.wants[1]}` : ""} ya!`, 2000));
        changed = true;
      } else if (bot.phase === "ordering") {
        if (now >= bot.orderedUntil) {
          bot.phase = "walking";
          bot.path = null;
        }
      } else if (bot.phase === "walking") {
        const target = this.seat(bot.targets.get(host.memberId)!);
        if (!target) continue;
        if (this.walkBot(bot, host, target.floor.id, target.seat, step)) {
          changed = true;
          continue;
        }
        const res = this.claimSeats(bot.visitId, [...bot.targets].map(([memberId, seatId]) => ({ memberId, seatId })));
        if (res.ok) {
          bot.phase = "seated";
          bot.stayUntil = now + 25000 + this.rand() * 25000;
          bot.nextChatAt = now + 4000 + this.rand() * 4000;
          this.placeOrder(bot.visitId, bot.wants);
        } else {
          // Someone took the table first: look for another one, or give up and leave.
          const seats = this.freeSeatsAtBestTable(bot.memberIds.length);
          if (seats) bot.targets = new Map(bot.memberIds.map((id, i) => [id, seats[i]!.id]));
          else bot.phase = "leaving";
        }
        bot.path = null;
        changed = true;
      } else if (bot.phase === "seated" && now < bot.stayUntil) {
        if (now >= bot.nextChatAt) {
          bot.nextChatAt = now + 7000 + this.rand() * 8000;
          this.chat(bot);
          changed = true;
        }
      } else if (bot.phase === "seated") {
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

    const due = this.later.filter((l) => l.at <= now);
    if (due.length) {
      this.later = this.later.filter((l) => l.at > now);
      due.forEach((l) => l.fn());
      changed = true;
    }
    for (const o of this.orders) {
      if (o.status === "new" && now >= o.readyAt) {
        o.status = "ready";
        this.say("barista", `Pesanan meja ${o.tableLabel} siap!`);
        changed = true;
      }
    }
    if (this.tickWaiter(dtMs)) changed = true;
    if (now >= this.nextBaristaLineAt) {
      this.nextBaristaLineAt = now + 18000 + this.rand() * 14000;
      if (!this.bubbles.has("barista")) this.say("barista", this.pick(BARISTA_IDLE));
    }

    for (const [id, e] of this.emotes) {
      if (e.until <= now) {
        this.emotes.delete(id);
        changed = true;
      }
    }
    for (const [id, b] of this.bubbles) {
      if (b.until <= now) {
        this.bubbles.delete(id);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  /** Seated groups talk among themselves; people alone mutter or chat with the next table. */
  private chat(bot: Bot) {
    const [a, b] = bot.memberIds.map((id) => this.members.get(id)).filter((m) => m?.seatId);
    if (!a) return;
    if (b && this.rand() < 0.8) {
      const [line, reply] = this.pick(CHATS);
      this.say(a.memberId, line);
      this.after(1600, () => this.members.has(b.memberId) && this.say(b.memberId, reply));
    } else if (this.rand() < 0.5) {
      this.say(a.memberId, this.pick(SOLO_LINES));
    } else {
      this.emote(a.memberId, this.rand() < 0.5 ? "cheers" : "laugh");
    }
  }

  /** The waiter takes ready orders from the counter to the table, one at a time. */
  private tickWaiter(dtMs: number): boolean {
    const w = this.staff[0]!;
    const step = (WAITER_SPEED * dtMs) / 1000;
    let task = this.waiterTask;
    if (!task) {
      const next = [...this.orders].reverse().find((o) => o.status === "ready");
      if (!next) {
        const home = this.waiterHome;
        if (w.floorId === this.floors[0]!.id && Math.hypot(home.x - w.x, home.y - w.y) < 0.05) return false;
        task = this.waiterTask = { orderId: "", phase: "return", path: null };
      } else {
        next.status = "delivering";
        task = this.waiterTask = { orderId: next.id, phase: "pickup", path: null };
      }
    }
    const order = this.orders.find((o) => o.id === task.orderId);
    if (task.phase !== "return" && (!order || order.status === "cancelled")) {
      w.carrying = false;
      this.waiterTask = { orderId: "", phase: "return", path: null };
      return true;
    }
    if (task.phase === "pickup") {
      if (this.walk(w, task, this.floors[0]!.id, this.counterSpot(2), step)) return true;
      w.carrying = true;
      w.facing = "back";
      this.waiterTask = { ...task, phase: "deliver", path: null };
      return true;
    }
    if (task.phase === "deliver") {
      const seated = [...this.members.values()].find((m) => m.visitId === order!.visitId && m.seatId);
      if (!seated) {
        // Nobody at the table any more: keep it ready and wait at the counter.
        order!.status = "ready";
        w.carrying = false;
        this.waiterTask = { orderId: "", phase: "return", path: null };
        return true;
      }
      const found = this.seat(seated.seatId!)!;
      const stand = standingSpot(found.floor, found.seat);
      if (this.walk(w, task, found.floor.id, stand, step)) return true;
      w.facing = facingFor(seated.x - w.x, seated.y - w.y, w.facing);
      w.carrying = false;
      order!.status = "served";
      for (const m of this.members.values()) if (m.visitId === order!.visitId && m.seatId) this.served.add(m.seatId);
      this.say(w.id, `Silakan, ${order!.items[0]}${order!.items.length > 1 ? ` dan lainnya` : ""}!`);
      this.after(1300, () => this.members.has(seated.memberId) && this.say(seated.memberId, this.pick(THANKS)));
      this.waiterTask = { orderId: "", phase: "return", path: null };
      return true;
    }
    if (this.walk(w, task, this.floors[0]!.id, this.waiterHome, step)) return true;
    w.facing = "front";
    this.waiterTask = null;
    return true;
  }

  /** Move any walker one step along a path toward `goal`, taking stairs between floors. */
  private walk(w: DemoStaff, route: { path: Point[] | null }, floorId: string, goal: Point, step: number): boolean {
    const floor = this.floor(w.floorId);
    const portal = w.floorId === floorId ? null : floor.objects?.find((o) => o.targetFloorId === floorId) ?? null;
    const legEnd = portal ? { x: portal.x + portal.width / 2, y: portal.y + portal.height / 2 } : goal;
    if (!route.path) route.path = findPath(floor, w, legEnd) ?? [legEnd];
    let next = route.path[0];
    while (next && Math.hypot(next.x - w.x, next.y - w.y) < 0.05) {
      route.path.shift();
      next = route.path[0];
    }
    if (!next) {
      route.path = null;
      if (!portal) return false;
      w.floorId = portal.targetFloorId!;
      w.x = portal.targetX ?? 1;
      w.y = portal.targetY ?? 1;
      return true;
    }
    const dx = next.x - w.x;
    const dy = next.y - w.y;
    const dist = Math.hypot(dx, dy);
    const d = Math.min(step, dist);
    w.facing = facingFor(dx, dy, w.facing);
    w.x += (dx / dist) * d;
    w.y += (dy / dist) * d;
    return true;
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

/** A walkable spot beside a chair, on the side away from its table, for the waiter to stand. */
function standingSpot(floor: FloorView, seat: { x: number; y: number; tableId: string | null }): Point {
  const t = seat.tableId ? floor.tables.find((x) => x.id === seat.tableId) : undefined;
  if (!t) return { x: seat.x, y: seat.y + 0.8 };
  const dx = seat.x - (t.x + t.width / 2);
  const dy = seat.y - (t.y + t.height / 2);
  const side = Math.abs(dx) / t.width > Math.abs(dy) / t.height;
  const p = side ? { x: seat.x + Math.sign(dx) * 0.8, y: seat.y } : { x: seat.x, y: seat.y + Math.sign(dy) * 0.8 };
  return { x: Math.min(Math.max(p.x, 0.4), floor.width - 0.4), y: Math.min(Math.max(p.y, 0.4), floor.height - 0.4) };
}
