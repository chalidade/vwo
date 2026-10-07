// In-browser job fair for the static demo: company booths with recruiters, the organisers'
// info desk, bot job seekers walking from booth to booth, and the applications they send.
import {
  type AvatarState,
  type CompanyBooth,
  type Facing,
  type FloorView,
  DEMO_JOB_FAIR,
  type JobFairView,
  SPONSOR_H,
  SPONSOR_W,
  boothSpot,
  buildJobFairFloors,
  fairFloorId,
  facingFor,
  findPath,
} from "@vwo/shared";

type Point = { x: number; y: number };

export interface FairVisitor extends AvatarState {
  isBot: boolean;
  arrivedAt: number;
}

/** A recruiter behind a booth desk, or the organisers' staff at the info desk. */
export interface FairStaff {
  id: string;
  name: string;
  boothId: string | null;
  floorId: string;
  x: number;
  y: number;
  facing: Facing;
}

export type ApplicationStatus = "Terkirim" | "Dilihat" | "Diundang interview" | "Belum cocok";

export interface FairApplication {
  id: string;
  at: number;
  visitorId: string;
  name: string;
  boothId: string;
  company: string;
  jobId: string;
  jobTitle: string;
  email: string;
  phone: string;
  cvUrl: string;
  message: string;
  status: ApplicationStatus;
  isBot: boolean;
}

export interface FairEvent {
  at: number;
  type: "arrive" | "visit" | "apply" | "leave" | "sponsor";
  name: string;
  company?: string;
  jobTitle?: string;
}

type Stop = { boothId: string; spot: "talk" | "banner" } | { sponsorId: string };
type Goal = Point & { floorId: string };

/** What the demo keeps between visits (in localStorage in the browser). */
export interface FairSaved {
  version: 1;
  applications: FairApplication[];
  visits: Record<string, number>;
  sponsorViews: Record<string, number>;
  /** Stamp cards of real visitors (not bots), by their stable id. */
  visitedBy: Record<string, string[]>;
}

export interface FairStorage {
  load(): FairSaved | null;
  save(data: FairSaved): void;
  clear(): void;
}

/** The player always uses this id, so their applications and stamps survive a reload. */
export const PLAYER_ID = "player";

interface Bot {
  id: string;
  plan: Stop[];
  phase: "walking" | "talking" | "reading" | "leaving";
  target: Goal | null;
  path: Point[] | null;
  until: number;
}

const BOT_NAMES = ["Andi", "Sari", "Dimas", "Putri", "Bayu", "Nadia", "Raka", "Tiara", "Fajar", "Laras", "Yoga", "Maya", "Rizky", "Intan", "Galih", "Citra"];
const WALK_SPEED = 2.3;
const MAX_BOTS = 10;
const QUESTIONS = [
  (b: CompanyBooth, job: string) => `Lowongan ${job} masih buka?`,
  (b: CompanyBooth) => `Kerja di ${b.company} seru nggak?`,
  () => "Fresh graduate boleh daftar?",
  () => "Ada program magang?",
  () => "Proses seleksinya berapa lama?",
  (b: CompanyBooth) => `Kantor ${b.company} di mana saja?`,
];
const ANSWERS = [
  (b: CompanyBooth, job: string) => `Masih! ${job} lagi kami cari.`,
  () => "Boleh banget, coba lihat banner kami.",
  () => "Sekitar 2–3 minggu sampai offering.",
  (b: CompanyBooth) => `Seru! ${b.tagline}.`,
  () => "Ada, detailnya di banner sebelah ya.",
];
const READING = ["Hmm, menarik...", "Gajinya lumayan!", "Cocok nih sama aku", "Catat dulu 📝", "Wah, banyak lowongan"];
const CALLOUTS = [(job: string) => `Kami cari ${job}! Mampir yuk!`, () => "Ayo tanya-tanya dulu!", () => "Ada merchandise buat pelamar 🎁", (job: string) => `Lowongan ${job}, langsung apply di sini!`];

export class DemoJobFair {
  readonly fair: JobFairView;
  /** One walkable floor per level of the hall, ground floor first. */
  readonly floors: FloorView[];
  readonly visitors = new Map<string, FairVisitor>();
  readonly staff: FairStaff[];
  readonly applications: FairApplication[] = [];
  readonly events: FairEvent[] = [];
  /** Visits counted per booth (a visitor stopping at its desk or banner). */
  readonly visits = new Map<string, number>();
  /** Booths each visitor has stopped by, for their stamp card. */
  readonly visitedBy = new Map<string, Set<string>>();
  /** How often each sponsor's banner was opened or read. */
  readonly sponsorViews = new Map<string, number>();
  readonly bubbles = new Map<string, { text: string; until: number }>();
  private bots: Bot[] = [];
  private seq = 0;
  private listeners = new Set<() => void>();
  private later: { at: number; fn: () => void }[] = [];
  private nextBotAt: number;
  private nextCalloutAt: number;

  constructor(
    private readonly rand: () => number = Math.random,
    private readonly now: () => number = () => Date.now(),
    fair: JobFairView = DEMO_JOB_FAIR,
    private readonly storage: FairStorage | null = null,
  ) {
    this.fair = fair;
    this.floors = buildJobFairFloors(fair);
    this.staff = [
      ...fair.booths.map((b) => ({ id: recruiterId(b.id), name: b.recruiter, boothId: b.id, floorId: fairFloorId(fair, b.floor), ...boothSpot(b, "recruiter"), facing: "front" as Facing })),
      { id: "fair-info", name: fair.infoDesk.staff, boothId: null, floorId: fairFloorId(fair, 0), x: fair.infoDesk.x + fair.infoDesk.width / 2, y: fair.infoDesk.y - 0.45, facing: "front" },
    ];
    this.nextBotAt = this.now() + 400;
    this.nextCalloutAt = this.now() + 5000;
    this.restore();
  }

  private dirty = false;

  private restore() {
    const saved = this.storage?.load();
    if (!saved || saved.version !== 1) return;
    for (const a of saved.applications ?? []) {
      if (!this.booth(a.boothId)) continue;
      this.applications.push({ ...a, status: a.status === "Terkirim" ? "Dilihat" : a.status });
    }
    for (const [k, n] of Object.entries(saved.visits ?? {})) this.visits.set(k, n);
    for (const [k, n] of Object.entries(saved.sponsorViews ?? {})) this.sponsorViews.set(k, n);
    for (const [k, ids] of Object.entries(saved.visitedBy ?? {})) this.visitedBy.set(k, new Set(ids));
  }

  private persist() {
    this.dirty = true;
  }

  /** Write pending changes to storage now. */
  flush() {
    if (!this.dirty || !this.storage) return;
    this.dirty = false;
    const real = new Set([...this.visitors.values()].filter((v) => !v.isBot).map((v) => v.memberId));
    real.add(PLAYER_ID);
    this.storage.save({
      version: 1,
      applications: this.applications.slice(0, 80),
      visits: Object.fromEntries(this.visits),
      sponsorViews: Object.fromEntries(this.sponsorViews),
      visitedBy: Object.fromEntries([...this.visitedBy].filter(([id]) => real.has(id)).map(([id, set]) => [id, [...set]])),
    });
  }

  /** Forget everything saved: applications, stamps and counters. */
  reset() {
    this.applications.length = 0;
    this.visits.clear();
    this.sponsorViews.clear();
    this.visitedBy.clear();
    this.events.length = 0;
    this.storage?.clear();
    this.dirty = false;
    this.emit();
  }

  booth(id: string) {
    return this.fair.booths.find((b) => b.id === id);
  }

  /** A floor by id; unknown ids fall back to the ground floor. */
  floor(id: string): FloorView {
    return this.floors.find((f) => f.id === id) ?? this.floors[0]!;
  }

  floorIdOf(item: { floor: number }) {
    return fairFloorId(this.fair, item.floor);
  }

  /** Take the stairs to another floor. */
  changeFloor(id: string, floorId: string, x: number, y: number) {
    const v = this.visitors.get(id);
    if (!v) return;
    v.floorId = floorId;
    v.x = x;
    v.y = y;
    this.emit();
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

  private pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.rand() * list.length)]!;
  }

  private after(ms: number, fn: () => void) {
    this.later.push({ at: this.now() + ms, fn });
  }

  say(id: string, text: string, ms = 2600) {
    this.bubbles.set(id, { text, until: this.now() + ms });
    this.emit();
  }

  join(name: string, isBot = false, id = this.id(isBot ? "bot" : "visitor")) {
    this.leave(id);
    const { x, y } = this.fair.spawn;
    const v: FairVisitor = { memberId: id, visitId: id, displayName: name, memberType: "host", floorId: this.floors[0]!.id, x, y, facing: "back", isBot, arrivedAt: this.now() };
    this.visitors.set(id, v);
    this.log({ type: "arrive", name });
    if (!isBot) this.say("fair-info", `Selamat datang, ${name}! Ada ${this.fair.booths.length} perusahaan di ${this.fair.floors.length} lantai.`, 3200);
    this.emit();
    return v;
  }

  leave(id: string) {
    const v = this.visitors.get(id);
    if (!v) return;
    this.visitors.delete(id);
    if (v.isBot) this.visitedBy.delete(id);
    this.bubbles.delete(id);
    this.bots = this.bots.filter((b) => b.id !== id);
    this.log({ type: "leave", name: v.displayName });
    this.emit();
  }

  move(id: string, x: number, y: number, facing?: Facing) {
    const v = this.visitors.get(id);
    if (!v) return;
    v.facing = facing ?? facingFor(x - v.x, y - v.y, v.facing);
    v.x = x;
    v.y = y;
    this.emit();
  }

  /** Count a stop at a booth: its desk or its banner. */
  visit(visitorId: string, boothId: string) {
    const v = this.visitors.get(visitorId);
    const b = this.booth(boothId);
    if (!v || !b) return;
    const seen = this.visitedBy.get(visitorId) ?? new Set<string>();
    seen.add(boothId);
    this.visitedBy.set(visitorId, seen);
    this.persist();
    this.visits.set(boothId, (this.visits.get(boothId) ?? 0) + 1);
    this.log({ type: "visit", name: v.displayName, company: b.company });
    this.emit();
  }

  /** Someone opened or read a sponsor's banner. */
  viewSponsor(visitorId: string, sponsorId: string) {
    const v = this.visitors.get(visitorId);
    const sp = this.fair.sponsors.find((x) => x.id === sponsorId);
    if (!v || !sp) return;
    this.sponsorViews.set(sponsorId, (this.sponsorViews.get(sponsorId) ?? 0) + 1);
    this.persist();
    this.log({ type: "sponsor", name: v.displayName, company: sp.name });
    this.emit();
  }

  apply(visitorId: string, input: { boothId: string; jobId: string; name?: string; email?: string; phone?: string; cvUrl?: string; message?: string }) {
    const v = this.visitors.get(visitorId);
    const b = this.booth(input.boothId);
    const job = b?.jobs.find((j) => j.id === input.jobId);
    if (!v || !b || !job) return null;
    if (this.applications.some((a) => a.visitorId === visitorId && a.jobId === job.id)) return null;
    const a: FairApplication = {
      id: this.id("app"),
      at: this.now(),
      visitorId,
      name: input.name?.trim() || v.displayName,
      boothId: b.id,
      company: b.company,
      jobId: job.id,
      jobTitle: job.title,
      email: input.email ?? "",
      phone: input.phone ?? "",
      cvUrl: input.cvUrl ?? "",
      message: input.message ?? "",
      status: "Terkirim",
      isBot: v.isBot,
    };
    this.applications.unshift(a);
    this.log({ type: "apply", name: a.name, company: b.company, jobTitle: job.title });
    this.persist();
    this.say(recruiterId(b.id), `Terima kasih, ${a.name}! Lamaran ${job.title} kami terima.`, 3200);
    this.after(6000, () => {
      if (a.status === "Terkirim") a.status = "Dilihat";
      this.persist();
      this.emit();
    });
    this.emit();
    return a;
  }

  /** The recruiter's decision, from the admin view. */
  setStatus(applicationId: string, status: ApplicationStatus) {
    const a = this.applications.find((x) => x.id === applicationId);
    if (!a) return;
    a.status = status;
    this.persist();
    this.emit();
  }

  /** Visitors standing in a booth's area right now. */
  peopleAt(boothId: string) {
    const b = this.booth(boothId);
    if (!b) return 0;
    let n = 0;
    const floorId = this.floorIdOf(b);
    for (const v of this.visitors.values()) if (v.floorId === floorId && v.x >= b.x && v.x <= b.x + 6 && v.y >= b.y && v.y <= b.y + 4.2) n++;
    return n;
  }

  private log(e: Omit<FairEvent, "at">) {
    this.events.unshift({ ...e, at: this.now() });
    this.events.length = Math.min(this.events.length, 60);
  }

  private nextFlushAt = 0;

  tick(dtMs: number) {
    const now = this.now();
    if (this.dirty && now >= this.nextFlushAt) {
      this.nextFlushAt = now + 1000;
      this.flush();
    }
    let changed = false;
    for (const [id, b] of this.bubbles) if (b.until <= now) {
      this.bubbles.delete(id);
      changed = true;
    }
    const due = this.later.filter((l) => l.at <= now);
    if (due.length) {
      this.later = this.later.filter((l) => l.at > now);
      due.forEach((l) => l.fn());
      changed = true;
    }

    if (now >= this.nextBotAt) {
      this.nextBotAt = now + 2500 + this.rand() * 4500;
      if (this.bots.length < MAX_BOTS) {
        this.spawnBot();
        changed = true;
      }
    }

    if (now >= this.nextCalloutAt) {
      this.nextCalloutAt = now + 7000 + this.rand() * 9000;
      const quiet = this.fair.booths.filter((b) => this.peopleAt(b.id) === 0 && !this.bubbles.has(recruiterId(b.id)));
      if (quiet.length) {
        const b = this.pick(quiet);
        this.say(recruiterId(b.id), this.pick(CALLOUTS)(this.pick(b.jobs).title), 3200);
      }
    }

    const step = (WALK_SPEED * Math.min(dtMs, 250)) / 1000;
    for (const bot of [...this.bots]) if (this.tickBot(bot, now, step)) changed = true;
    if (changed) this.emit();
  }

  private spawnBot() {
    const v = this.join(this.pick(BOT_NAMES), true);
    // Shuffle, keep a few, then visit them floor by floor going up.
    const booths = [...this.fair.booths]
      .sort(() => this.rand() - 0.5)
      .slice(0, 2 + Math.floor(this.rand() * 3))
      .sort((a, b) => a.floor - b.floor);
    const plan: Stop[] = booths.map((b) => ({ boothId: b.id, spot: this.rand() < 0.65 ? "talk" : "banner" }) as Stop);
    if (this.rand() < 0.4) {
      // A sponsor on a floor the bot is visiting anyway.
      const floors = new Set(booths.map((b) => b.floor));
      const sponsors = this.fair.sponsors.filter((sp) => floors.has(sp.floor));
      if (sponsors.length) {
        const sp = this.pick(sponsors);
        const at = booths.findIndex((b) => b.floor === sp.floor);
        plan.splice(at + Math.floor(this.rand() * 2), 0, { sponsorId: sp.id });
      }
    }
    this.bots.push({ id: v.memberId, plan, phase: "walking", target: null, path: null, until: 0 });
  }

  private tickBot(bot: Bot, now: number, step: number): boolean {
    const v = this.visitors.get(bot.id);
    if (!v) {
      this.bots = this.bots.filter((b) => b !== bot);
      return true;
    }
    const stop = bot.plan[0];
    if (bot.phase === "walking") {
      if (!stop) {
        bot.phase = "leaving";
        bot.target = { floorId: this.floors[0]!.id, x: this.fair.spawn.x + (this.rand() - 0.5), y: this.fair.height - 0.4 };
        bot.path = null;
        return true;
      }
      if ("sponsorId" in stop) {
        const sp = this.fair.sponsors.find((x) => x.id === stop.sponsorId)!;
        if (!bot.target) bot.target = { floorId: this.floorIdOf(sp), x: sp.x + SPONSOR_W / 2 + (this.rand() - 0.5) * 0.6, y: sp.y + SPONSOR_H + 0.75 };
        if (this.walk(v, bot, bot.target, step)) return true;
        v.facing = "back";
        bot.target = null;
        bot.phase = "reading";
        bot.until = now + 2200 + this.rand() * 1800;
        this.viewSponsor(v.memberId, sp.id);
        this.after(500, () => this.visitors.has(v.memberId) && this.say(v.memberId, sp.promo ? "Wah, ada promo!" : `Oh, ${sp.name}!`, 1800));
        return true;
      }
      const booth = this.booth(stop.boothId)!;
      if (!bot.target) {
        const base = boothSpot(booth, stop.spot);
        const floorId = this.floorIdOf(booth);
        bot.target =
          stop.spot === "talk"
            ? { floorId, x: base.x + (this.rand() - 0.5) * 2.2, y: base.y + this.rand() * 0.3 }
            : { floorId, x: base.x + (this.rand() - 0.5) * 0.3, y: base.y + this.rand() * 0.2 };
      }
      if (this.walk(v, bot, bot.target, step)) return true;
      v.facing = "back";
      bot.target = null;
      this.visit(v.memberId, booth.id);
      const job = this.pick(booth.jobs);
      if (stop.spot === "talk") {
        bot.phase = "talking";
        const applies = this.rand() < 0.4;
        bot.until = now + (applies ? 7600 : 4600) + this.rand() * 1500;
        const rid = recruiterId(booth.id);
        this.say(v.memberId, this.pick(QUESTIONS)(booth, job.title), 2200);
        this.after(1700, () => this.visitors.has(v.memberId) && this.say(rid, this.pick(ANSWERS)(booth, job.title), 2600));
        if (applies) {
          this.after(4300, () => this.visitors.has(v.memberId) && this.say(v.memberId, `Saya mau melamar ${job.title}!`, 2200));
          this.after(5600, () => this.visitors.has(v.memberId) && this.apply(v.memberId, { boothId: booth.id, jobId: job.id, email: `${v.displayName.toLowerCase()}@contoh.id` }));
        }
      } else {
        bot.phase = "reading";
        bot.until = now + 2600 + this.rand() * 2400;
        this.after(600, () => this.visitors.has(v.memberId) && this.say(v.memberId, this.pick(READING), 2000));
      }
      return true;
    }
    if (bot.phase === "talking" || bot.phase === "reading") {
      if (now < bot.until) return false;
      bot.plan.shift();
      bot.phase = "walking";
      return false;
    }
    // Leaving: walk out of the door.
    if (bot.target && this.walk(v, bot, bot.target, step)) return true;
    this.leave(v.memberId);
    return true;
  }

  /** One step toward `goal`, taking the stairs when it is on another floor. False once arrived. */
  private walk(v: FairVisitor, route: { path: Point[] | null }, goal: Goal, step: number): boolean {
    const floor = this.floor(v.floorId);
    const portal = v.floorId === goal.floorId ? null : this.stairsToward(floor, goal.floorId);
    const legEnd = portal ? { x: portal.x + portal.width / 2, y: portal.y + portal.height / 2 } : goal;
    if (!route.path) route.path = findPath(floor, v, legEnd) ?? [legEnd];
    let next = route.path[0];
    while (next && Math.hypot(next.x - v.x, next.y - v.y) < 0.05) {
      route.path.shift();
      next = route.path[0];
    }
    if (!next) {
      route.path = null;
      if (!portal) return false;
      v.floorId = portal.targetFloorId!;
      v.x = portal.targetX ?? 1;
      v.y = portal.targetY ?? 1;
      return true;
    }
    const dx = next.x - v.x;
    const dy = next.y - v.y;
    const dist = Math.hypot(dx, dy);
    const d = Math.min(step, dist);
    v.facing = facingFor(dx, dy, v.facing);
    v.x += (dx / dist) * d;
    v.y += (dy / dist) * d;
    return true;
  }

  /** The flight of stairs on `floor` that leads one level closer to `floorId`. */
  stairsToward(floor: FloorView, floorId: string) {
    const from = this.floors.indexOf(floor);
    const to = this.floors.findIndex((f) => f.id === floorId);
    const next = this.floors[from + Math.sign(to - from)];
    return (floor.objects ?? []).find((o) => o.type === "stairs" && o.targetFloorId === next?.id) ?? null;
  }
}

export const recruiterId = (boothId: string) => `rec-${boothId}`;
