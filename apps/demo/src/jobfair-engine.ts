// In-browser job fair for the static demo: company booths with recruiters, the organisers'
// info desk, bot job seekers walking from booth to booth, and the applications they send.
import {
  type AvatarState,
  COIN_STAND_SPOTS,
  type CompanyBooth,
  type Facing,
  type FairRoom,
  type FairStop,
  type FloorView,
  DEMO_JOB_FAIR,
  type JobFairView,
  SPONSOR_H,
  SPONSOR_W,
  boothSpot,
  buildJobFairFloors,
  fairFloorId,
  fairFloorIndex,
  LIFT_FRONT,
  fairRoomFloorId,
  fairStops,
  stallSpot,
  facingFor,
  findPath,
} from "@vwo/shared";
import { APPLY_COST, DAILY_COINS, FOOD_VOUCHERS, SEMINARS, START_COINS, VERIFY_COST, XP, type VoucherKind, levelOf } from "./fair/content";

type Point = { x: number; y: number };

export interface FairVisitor extends AvatarState {
  isBot: boolean;
  arrivedAt: number;
  /** A real person on another device, mirrored from the live channel. */
  remote?: boolean;
  /** Shows the blue check by their name. */
  verified?: boolean;
}

/** What another device says about its player, already checked by the live channel. */
export interface RemotePlayer {
  id: string;
  name: string;
  floorId: string;
  x: number;
  y: number;
  facing: Facing;
  seatId: string | null;
  say: string | null;
  verified?: boolean;
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
  /** The company's rating of the applicant, 1–5 stars, with a short note. */
  rating?: number;
  feedback?: string;
  /** Best psikotes score the applicant had when applying, in percent. */
  psych?: number;
  /** The applicant had the blue check when applying. */
  verified?: boolean;
}

/** A job seeker's review of a company. */
export interface CompanyReview {
  at: number;
  by: string;
  stars: number;
  tag?: string;
}

export interface Voucher {
  id: string;
  kind: VoucherKind;
  title: string;
  room?: string;
  coins?: number;
  code?: string;
  /** Merchant vouchers: value at the outlet, conditions, and where to redeem. */
  worth?: string;
  terms?: string;
  outlet?: string;
  from: string;
  at: number;
  used: boolean;
}

export interface AdStat {
  views: number;
  clicks: number;
  sold: number;
  coins: number;
}

export interface CoinTxn {
  at: number;
  amount: number;
  reason: string;
}

export interface PsychResult {
  at: number;
  score: number;
  total: number;
  grade: string;
  sections: Record<string, { right: number; total: number }>;
}

/** The player's game state: coins, vouchers, tickets, XP, and what they did in the rooms. */
export interface PlayerState {
  coins: number;
  txns: CoinTxn[];
  vouchers: Voucher[];
  /** Rooms paid for. */
  tickets: string[];
  xp: number;
  psych: PsychResult[];
  seminars: string[];
  /** Day (YYYY-MM-DD) the free daily coins were last claimed. */
  dailyOn: string | null;
  meals: number;
  /** Bought the blue verified check. */
  verified?: boolean;
}

export interface FairEvent {
  at: number;
  type: "arrive" | "visit" | "apply" | "leave" | "sponsor" | "rate" | "review" | "room" | "coins";
  name: string;
  company?: string;
  jobTitle?: string;
}

type Stop = { boothId: string; spot: "talk" | "banner" } | { sponsorId: string };
type Goal = Point & { floorId: string };

/** What the demo keeps between visits (in localStorage in the browser). */
export interface FairSaved {
  version: 1 | 2;
  applications: FairApplication[];
  visits: Record<string, number>;
  sponsorViews: Record<string, number>;
  /** Stamp cards of real visitors (not bots), by their stable id. */
  visitedBy: Record<string, string[]>;
  /** From version 2. */
  player?: PlayerState;
  reviews?: Record<string, CompanyReview[]>;
  ads?: Record<string, AdStat>;
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
const ROOM_CHATTER: Record<FairRoom["kind"], string[]> = {
  foodcourt: ["Nyam 😋", "Baksonya enak!", "Dapat voucher lamar gratis!", "Istirahat dulu ah", "Abis ini ke Lantai 3"],
  psikotes: ["Hmm... 2, 4, 8, 16...", "Soal logikanya tricky", "Fokus, fokus...", "Semoga lulus 🙏", "✏️"],
  seminar: ["Catat 📝", "Wah, insightful!", "Setuju!", "👏", "Metode STAR ya..."],
};
const READING = ["Hmm, menarik...", "Gajinya lumayan!", "Cocok nih sama aku", "Catat dulu 📝", "Wah, banyak lowongan"];
const CALLOUTS = [(job: string) => `Kami cari ${job}! Mampir yuk!`, () => "Ayo tanya-tanya dulu!", () => "Ada merchandise buat pelamar 🎁", (job: string) => `Lowongan ${job}, langsung apply di sini!`];

export class DemoJobFair {
  readonly fair: JobFairView;
  /** One walkable floor per hall level, ground floor first, then one per room floor. */
  readonly floors: FloorView[];
  /** Every floor the lift stops at, bottom first. */
  readonly stops: FairStop[];
  readonly player: PlayerState = freshPlayer();
  /** Reviews by job seekers, per booth. */
  readonly reviews = new Map<string, CompanyReview[]>();
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
  private nextPromoAt = 0;

  constructor(
    private readonly rand: () => number = Math.random,
    private readonly now: () => number = () => Date.now(),
    fair: JobFairView = DEMO_JOB_FAIR,
    private readonly storage: FairStorage | null = null,
  ) {
    this.fair = fair;
    this.floors = buildJobFairFloors(fair);
    this.stops = fairStops(fair);
    this.staff = [
      ...fair.booths.map((b) => ({ id: recruiterId(b.id), name: b.recruiter, boothId: b.id, floorId: fairFloorId(fair, b.floor), ...boothSpot(b, "recruiter"), facing: "front" as Facing })),
      { id: "fair-info", name: fair.infoDesk.staff, boothId: null, floorId: fairFloorId(fair, 0), x: fair.infoDesk.x + fair.infoDesk.width / 2, y: fair.infoDesk.y - 0.45, facing: "front" },
      {
        id: "coin-staff",
        name: fair.coinStand.staff,
        boothId: null,
        floorId: fairFloorId(fair, fair.coinStand.floor),
        x: fair.coinStand.x + COIN_STAND_SPOTS.staff.x,
        y: fair.coinStand.y + COIN_STAND_SPOTS.staff.y,
        facing: "front",
      },
      ...fair.rooms.flatMap((room): FairStaff[] => {
        const floorId = fairRoomFloorId(fair, room.id);
        const host = { id: roomStaffId(room.id), name: room.staff.name, boothId: null, floorId, facing: "front" as Facing };
        if (room.kind === "foodcourt")
          return [
            { ...host, x: 3, y: room.height - 2.4 },
            ...(room.stalls ?? []).map((st, i) => ({ id: stallStaffId(st.id), name: st.vendor, boothId: null, floorId, ...stallSpot(i, "vendor"), facing: "front" as Facing })),
          ];
        return [{ ...host, x: room.width / 2, y: room.kind === "seminar" ? 2.0 : 0.85 }];
      }),
      ...fair.promoters.map((p) => ({ id: promoterId(p.id), name: `📣 ${p.brand}`, boothId: null, floorId: this.stops.find((st) => st.level === p.level)!.floorId, x: p.x, y: p.y, facing: "front" as Facing })),
    ];
    this.nextBotAt = this.now() + 400;
    this.nextCalloutAt = this.now() + 5000;
    this.restore();
  }

  private dirty = false;

  private restore() {
    const saved = this.storage?.load();
    if (!saved || (saved.version !== 1 && saved.version !== 2)) return;
    if (saved.player) Object.assign(this.player, freshPlayer(), saved.player);
    for (const [k, list] of Object.entries(saved.reviews ?? {})) if (this.booth(k)) this.reviews.set(k, list);
    for (const a of saved.applications ?? []) {
      if (!this.booth(a.boothId)) continue;
      this.applications.push({ ...a, status: a.status === "Terkirim" ? "Dilihat" : a.status });
    }
    for (const [k, n] of Object.entries(saved.visits ?? {})) this.visits.set(k, n);
    for (const [k, n] of Object.entries(saved.sponsorViews ?? {})) this.sponsorViews.set(k, n);
    for (const [k, a] of Object.entries(saved.ads ?? {})) this.ads.set(k, a);
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
      version: 2,
      player: this.player,
      reviews: Object.fromEntries([...this.reviews].map(([k, list]) => [k, list.slice(0, 30)])),
      applications: this.applications.slice(0, 80),
      visits: Object.fromEntries(this.visits),
      sponsorViews: Object.fromEntries(this.sponsorViews),
      ads: Object.fromEntries(this.ads),
      visitedBy: Object.fromEntries([...this.visitedBy].filter(([id]) => real.has(id)).map(([id, set]) => [id, [...set]])),
    });
  }

  /** Forget everything saved: applications, stamps and counters. */
  reset() {
    this.applications.length = 0;
    this.visits.clear();
    this.sponsorViews.clear();
    this.ads.clear();
    this.visitedBy.clear();
    this.reviews.clear();
    Object.assign(this.player, freshPlayer());
    const me = this.visitors.get(PLAYER_ID);
    if (me) me.verified = false;
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

  room(id: string) {
    return this.fair.rooms.find((r) => r.id === id);
  }

  /** The room a floor id belongs to, if it is a room rather than a hall floor. */
  roomOf(floorId: string): FairRoom | undefined {
    return this.fair.rooms.find((r) => fairRoomFloorId(this.fair, r.id) === floorId);
  }

  /** The building level of a floor: a hall's index, or the level a room floor sits on. */
  levelOf(floorId: string) {
    return this.roomOf(floorId)?.level ?? Math.max(0, fairFloorIndex(floorId));
  }

  /** The lift stop for a floor id. */
  stopOf(floorId: string): FairStop {
    return this.stops.find((s) => s.floorId === floorId) ?? this.stops[0]!;
  }

  /** Ride the lift: step out in front of the lift doors on the chosen floor. */
  ride(id: string, floorId: string) {
    this.changeFloor(id, floorId, LIFT_FRONT.x, LIFT_FRONT.y);
    const v = this.visitors.get(id);
    if (v) v.facing = "front";
  }

  /** Move someone to another floor. */
  changeFloor(id: string, floorId: string, x: number, y: number) {
    const v = this.visitors.get(id);
    if (!v) return;
    v.floorId = floorId;
    v.x = x;
    v.y = y;
    v.seatId = null;
    const room = this.roomOf(floorId);
    if (room && !v.isBot) {
      this.log({ type: "room", name: v.displayName, company: room.name });
      if (room.kind === "foodcourt") this.say(roomStaffId(room.id), `Selamat makan, ${v.displayName}! Tiap pesanan dapat voucher 🎟️`, 3000);
      else if (room.kind === "psikotes") this.say(roomStaffId(room.id), "Silakan duduk di meja yang kosong, lalu mulai tesnya.", 3000);
      else this.say(roomStaffId(room.id), `Selamat datang! Silakan duduk, seminar segera dimulai.`, 3000);
    }
    this.emit();
  }

  /** Sit down on a free chair of the visitor's floor. */
  sit(id: string, seatId: string) {
    const v = this.visitors.get(id);
    const seat = v && this.floor(v.floorId).seats.find((s) => s.id === seatId);
    if (!v || !seat || this.seatTaken(seatId, id)) return false;
    v.seatId = seat.id;
    v.x = seat.x;
    v.y = seat.y;
    this.emit();
    return true;
  }

  stand(id: string) {
    const v = this.visitors.get(id);
    if (!v?.seatId) return;
    v.seatId = null;
    this.emit();
  }

  seatTaken(seatId: string, except?: string) {
    for (const v of this.visitors.values()) if (v.seatId === seatId && v.memberId !== except) return true;
    return false;
  }

  occupiedSeats() {
    return new Set([...this.visitors.values()].map((v) => v.seatId).filter((x): x is string => !!x));
  }

  // --- Coins, vouchers and XP (the player only; bots don't pay).

  private spend(amount: number, reason: string) {
    if (this.player.coins < amount) return false;
    this.player.coins -= amount;
    this.player.txns.unshift({ at: this.now(), amount: -amount, reason });
    this.player.txns.length = Math.min(this.player.txns.length, 50);
    this.persist();
    return true;
  }

  private earn(amount: number, reason: string) {
    this.player.coins += amount;
    this.player.txns.unshift({ at: this.now(), amount, reason });
    this.player.txns.length = Math.min(this.player.txns.length, 50);
    this.persist();
  }

  gainXp(amount: number) {
    const before = levelOf(this.player.xp).level;
    this.player.xp += amount;
    this.persist();
    const after = levelOf(this.player.xp).level;
    if (after > before) this.levelUps.push(after);
    this.emit();
  }

  /** Levels the player just reached, for the UI to celebrate. */
  readonly levelUps: number[] = [];

  /** Top up coins at the coin stand (a demo payment). */
  buyCoins(packageId: string, method: string) {
    const pkg = this.fair.coinStand.packages.find((p) => p.id === packageId);
    if (!pkg) return null;
    this.earn(pkg.coins + pkg.bonus, `Beli ${pkg.coins}${pkg.bonus ? ` + ${pkg.bonus} bonus` : ""} koin (${method}, ${pkg.price})`);
    this.log({ type: "coins", name: this.visitors.get(PLAYER_ID)?.displayName ?? "Kamu", company: pkg.price });
    this.say("coin-staff", `Pembayaran ${pkg.price} berhasil! +${pkg.coins + pkg.bonus} koin 🪙`, 3000);
    this.emit();
    return pkg.coins + pkg.bonus;
  }

  canClaimDaily() {
    return this.player.dailyOn !== this.today();
  }

  claimDaily() {
    if (!this.canClaimDaily()) return false;
    this.player.dailyOn = this.today();
    this.earn(DAILY_COINS, "Koin gratis harian");
    this.emit();
    return true;
  }

  private today() {
    return new Date(this.now()).toISOString().slice(0, 10);
  }

  hasTicket(roomId: string) {
    return this.room(roomId)?.price === 0 || this.player.tickets.includes(roomId);
  }

  /** What entering a room costs right now, and which voucher would be used. */
  roomPrice(roomId: string) {
    const room = this.room(roomId);
    if (!room) return { price: 0, voucher: null as Voucher | null };
    const free = this.player.vouchers.find((v) => !v.used && v.kind === "room-free" && v.room === roomId);
    const half = this.player.vouchers.find((v) => !v.used && v.kind === "room-half" && v.room === roomId);
    if (free) return { price: 0, voucher: free };
    if (half) return { price: Math.ceil(room.price / 2), voucher: half };
    return { price: room.price, voucher: null };
  }

  /** Buy a ticket for a premium room. False when there are not enough coins. */
  buyTicket(roomId: string) {
    const room = this.room(roomId);
    if (!room) return false;
    if (this.hasTicket(roomId)) return true;
    const { price, voucher } = this.roomPrice(roomId);
    if (price > 0 && !this.spend(price, `Tiket ${room.name}`)) return false;
    if (voucher) voucher.used = true;
    this.player.tickets.push(roomId);
    this.persist();
    this.emit();
    return true;
  }

  /** Buy a voucher for a food court business's real outlet. Every purchase also comes with a
   *  small job fair bonus (a free application, a room discount, cashback). */
  buyDeal(stallId: string, dealId: string) {
    const room = this.fair.rooms.find((r) => r.stalls?.some((s) => s.id === stallId));
    const stall = room?.stalls?.find((s) => s.id === stallId);
    const deal = stall?.deals.find((d) => d.id === dealId);
    if (!stall || !deal) return null;
    if (!this.spend(deal.price, `Voucher ${stall.name}: ${deal.title}`)) return null;
    const code = `${stall.id.slice(0, 4).toUpperCase()}-${String(Math.floor(this.rand() * 9000) + 1000)}${String.fromCharCode(65 + (this.seq % 26))}`;
    const voucher: Voucher = { id: this.id("vc"), kind: "merchant", title: deal.title, code, worth: deal.worth, terms: deal.terms, outlet: `${stall.name} · ${stall.address}`, from: stall.name, at: this.now(), used: false };
    const t = this.pick(FOOD_VOUCHERS.filter((v) => v.kind !== "sponsor"));
    const bonus: Voucher = { id: this.id("vc"), kind: t.kind, title: t.title, room: t.room, coins: t.coins, code: t.code, from: `Bonus ${stall.name}`, at: this.now(), used: false };
    this.player.vouchers.unshift(bonus, voucher);
    this.player.meals++;
    if (bonus.kind === "coins" && bonus.coins) {
      bonus.used = true;
      this.earn(bonus.coins, `Cashback dari ${stall.name}`);
    }
    this.ad(`stall:${stall.id}`, "sold", deal.price);
    this.say(stallStaffId(stall.id), `Terima kasih! Tunjukkan kode ${code} di outlet kami 🎟️`, 3000);
    this.gainXp(XP.food);
    this.persist();
    this.emit();
    return { deal, voucher, bonus };
  }

  /** Keep a promoter's promo code in the wallet. */
  savePromo(id: string) {
    const p = this.fair.promoters.find((x) => x.id === id);
    if (!p?.code || this.hasPromo(id)) return false;
    this.player.vouchers.unshift({ id: this.id("vc"), kind: "sponsor", title: `${p.brand}: ${p.headline}`, code: p.code, from: p.brand, at: this.now(), used: false });
    this.ad(`promo:${p.id}`, "click");
    return true;
  }

  hasPromo(id: string) {
    const p = this.fair.promoters.find((x) => x.id === id);
    return !!p && this.player.vouchers.some((v) => v.kind === "sponsor" && v.code === p.code && v.from === p.brand);
  }

  /** Reach of paid placements (food court stalls, promoter NPCs): views, clicks, sales. */
  readonly ads = new Map<string, AdStat>();

  ad(key: string, what: "view" | "click" | "sold", coins = 0) {
    const a = this.ads.get(key) ?? { views: 0, clicks: 0, sold: 0, coins: 0 };
    if (what === "view") a.views++;
    else if (what === "click") a.clicks++;
    else {
      a.sold++;
      a.coins += coins;
    }
    this.ads.set(key, a);
    this.persist();
    this.emit();
  }

  /** Buy the blue verified check with coins. */
  buyVerified() {
    if (this.player.verified) return true;
    if (!this.spend(VERIFY_COST, "Centang biru (verified)")) return false;
    this.player.verified = true;
    const v = this.visitors.get(PLAYER_ID);
    if (v) v.verified = true;
    this.persist();
    this.emit();
    return true;
  }

  /** Free applications left from vouchers. */
  freeApplies() {
    return this.player.vouchers.filter((v) => !v.used && v.kind === "free-apply").length;
  }

  canAffordApply() {
    return this.freeApplies() > 0 || this.player.coins >= APPLY_COST;
  }

  recordPsych(result: Omit<PsychResult, "at">) {
    this.player.psych.unshift({ ...result, at: this.now() });
    this.player.psych.length = Math.min(this.player.psych.length, 10);
    this.gainXp(Math.round((result.score / result.total) * XP.psychMax));
    this.persist();
  }

  bestPsych() {
    const best = this.player.psych.reduce<PsychResult | null>((b, r) => (!b || r.score / r.total > b.score / b.total ? r : b), null);
    return best ? Math.round((best.score / best.total) * 100) : null;
  }

  attendSeminar(seminarId: string) {
    if (this.player.seminars.includes(seminarId)) return false;
    this.player.seminars.push(seminarId);
    this.gainXp(XP.seminar);
    this.persist();
    return true;
  }

  // --- Ratings: companies rate applicants, job seekers review companies.

  /** A seeker's review of a company. One per visitor per company; a new one replaces the old. */
  reviewCompany(visitorId: string, boothId: string, stars: number, tag?: string) {
    const v = this.visitors.get(visitorId);
    const b = this.booth(boothId);
    if (!v || !b) return;
    const list = (this.reviews.get(boothId) ?? []).filter((r) => r.by !== visitorId);
    const first = list.length === (this.reviews.get(boothId) ?? []).length;
    list.unshift({ at: this.now(), by: visitorId, stars: Math.max(1, Math.min(5, Math.round(stars))), tag });
    this.reviews.set(boothId, list.slice(0, 40));
    this.log({ type: "review", name: v.displayName, company: b.company, jobTitle: "★".repeat(stars) });
    if (!v.isBot && first) this.gainXp(XP.review);
    this.persist();
    this.emit();
  }

  myReview(visitorId: string, boothId: string) {
    return this.reviews.get(boothId)?.find((r) => r.by === visitorId) ?? null;
  }

  /** A company's star rating: earlier reviews (seeded per booth) plus the ones written today. */
  companyRating(boothId: string) {
    const base = seededReviews(boothId);
    const list = this.reviews.get(boothId) ?? [];
    const count = base.count + list.length;
    const sum = base.sum + list.reduce((n, r) => n + r.stars, 0);
    return { count, average: count ? sum / count : 0 };
  }

  /** A company levels up with good reviews, applications and visits. */
  companyXp(boothId: string) {
    const r = this.companyRating(boothId);
    const apps = this.applications.filter((a) => a.boothId === boothId).length;
    return Math.round(r.count * r.average * 4 + apps * 8 + (this.visits.get(boothId) ?? 0) * 2);
  }

  /** The organiser (or the company) rates an applicant. */
  rateApplicant(applicationId: string, stars: number, feedback?: string) {
    const a = this.applications.find((x) => x.id === applicationId);
    if (!a) return;
    const before = a.rating ?? 0;
    a.rating = Math.max(1, Math.min(5, Math.round(stars)));
    if (feedback) a.feedback = feedback;
    this.log({ type: "rate", name: a.name, company: a.company, jobTitle: "★".repeat(a.rating) });
    if (a.visitorId === PLAYER_ID && a.rating > before) this.gainXp((a.rating - before) * XP.ratedPerStar);
    this.persist();
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

  /** Show or update a player from another device. */
  upsertRemote(p: RemotePlayer) {
    const id = remoteId(p.id);
    const floor = this.floors.find((f) => f.id === p.floorId);
    if (!floor) return;
    const seatId = p.seatId && floor.seats.some((s) => s.id === p.seatId) ? p.seatId : null;
    let v = this.visitors.get(id);
    if (!v) {
      v = { memberId: id, visitId: id, displayName: `🌐 ${p.name}`, memberType: "host", floorId: floor.id, x: p.x, y: p.y, facing: p.facing, isBot: false, remote: true, arrivedAt: this.now() };
      this.visitors.set(id, v);
      this.log({ type: "arrive", name: `${p.name} (online)` });
    }
    Object.assign(v, { displayName: `🌐 ${p.name}`, floorId: floor.id, x: p.x, y: p.y, facing: p.facing, seatId, verified: !!p.verified });
    const bubble = this.bubbles.get(id);
    if (p.say && bubble?.text !== p.say) this.say(id, p.say, 3000);
    else this.emit();
  }

  removeRemote(peerId: string) {
    this.leave(remoteId(peerId));
  }

  join(name: string, isBot = false, id = this.id(isBot ? "bot" : "visitor")) {
    this.leave(id);
    const { x, y } = this.fair.spawn;
    const v: FairVisitor = { memberId: id, visitId: id, displayName: name, memberType: "host", floorId: this.floors[0]!.id, x, y, facing: "back", isBot, arrivedAt: this.now() };
    if (id === PLAYER_ID) v.verified = !!this.player.verified;
    // A few bots are verified too, so the badge is something people recognise.
    else if (isBot && this.rand() < 0.25) v.verified = true;
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
    if (!v.isBot) {
      // Real seekers pay for each application: a free-apply voucher first, otherwise coins.
      const voucher = this.player.vouchers.find((x) => !x.used && x.kind === "free-apply");
      if (voucher) voucher.used = true;
      else if (!this.spend(APPLY_COST, `Lamar ${job.title} di ${b.company}`)) return null;
    }
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
      psych: v.isBot ? (this.rand() < 0.5 ? 50 + Math.round(this.rand() * 50) : undefined) : (this.bestPsych() ?? undefined),
      verified: !!v.verified,
    };
    this.applications.unshift(a);
    this.log({ type: "apply", name: a.name, company: b.company, jobTitle: job.title });
    this.persist();
    this.say(recruiterId(b.id), `Terima kasih, ${a.name}! Lamaran ${job.title} kami terima.`, 3200);
    if (!v.isBot) this.gainXp(XP.apply);
    this.after(6000, () => {
      if (a.status === "Terkirim") a.status = "Dilihat";
      this.persist();
      this.emit();
    });
    // The company reads the application and rates the applicant a little later.
    this.after(12000 + this.rand() * 6000, () => {
      if (a.rating) return;
      const stars = this.autoRating(a);
      this.rateApplicant(a.id, stars, FEEDBACK[stars - 1]);
      if (a.status === "Dilihat" || a.status === "Terkirim") a.status = stars >= 4 ? "Diundang interview" : stars <= 2 ? "Belum cocok" : "Dilihat";
      if (a.visitorId === PLAYER_ID) this.notices.push(`${a.company} memberi kamu ${"★".repeat(stars)} untuk lamaran ${a.jobTitle}`);
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

  /** Messages for the player that the UI shows as toasts, oldest first. */
  readonly notices: string[] = [];

  /** How a company rates an application: a complete form, a CV and a good psikotes score help. */
  private autoRating(a: FairApplication) {
    let score = 2.4 + this.rand() * 1.4;
    if (a.cvUrl) score += 0.6;
    if (a.phone) score += 0.2;
    if (a.message.length > 30) score += 0.4;
    if (a.psych != null) score += (a.psych - 50) / 50;
    return Math.max(1, Math.min(5, Math.round(score)));
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

    if (now >= this.nextPromoAt) {
      this.nextPromoAt = now + 6000 + this.rand() * 6000;
      const quiet = this.fair.promoters.filter((p) => !this.bubbles.has(promoterId(p.id)));
      if (quiet.length) {
        const p = this.pick(quiet);
        this.say(promoterId(p.id), this.pick(p.callouts), 3200);
      }
    }

    if (now >= this.nextRoomAt) {
      this.nextRoomAt = now + 2500 + this.rand() * 3000;
      this.tickRooms();
      changed = true;
    }

    const step = (WALK_SPEED * Math.min(dtMs, 250)) / 1000;
    for (const bot of [...this.bots]) if (this.tickBot(bot, now, step)) changed = true;
    if (changed) this.emit();
  }

  private nextRoomAt = 0;
  private speakerLine = 0;

  /** Rooms fill and empty on their own: people sit down, eat, take tests, and leave. */
  private tickRooms() {
    for (const room of this.fair.rooms) {
      const floor = this.floor(fairRoomFloorId(this.fair, room.id));
      const inRoom = [...this.visitors.values()].filter((v) => v.floorId === floor.id && v.isBot);
      const target = Math.round(floor.seats.length * (room.kind === "seminar" ? 0.5 : room.kind === "psikotes" ? 0.4 : 0.35));
      if (inRoom.length < target && this.rand() < 0.7) {
        const free = floor.seats.filter((st) => !this.seatTaken(st.id));
        const seat = free.length ? this.pick(free) : null;
        if (seat) {
          const id = this.id("guest");
          this.visitors.set(id, { memberId: id, visitId: id, displayName: this.pick(BOT_NAMES), memberType: "host", floorId: floor.id, x: seat.x, y: seat.y, seatId: seat.id, facing: "back", isBot: true, arrivedAt: this.now() });
        }
      } else if (inRoom.length && this.rand() < 0.25) {
        const v = this.pick(inRoom);
        this.visitors.delete(v.memberId);
        this.bubbles.delete(v.memberId);
      } else if (inRoom.length && this.rand() < 0.5) {
        const v = this.pick(inRoom);
        this.say(v.memberId, this.pick(ROOM_CHATTER[room.kind]), 2200);
      }
      if (room.kind === "seminar" && this.rand() < 0.6) {
        const session = SEMINARS[Math.floor(this.now() / 180000) % SEMINARS.length]!;
        const slide = session.slides[this.speakerLine++ % session.slides.length]!;
        this.say(roomStaffId(room.id), slide.say, 3600);
      }
    }
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
        if (this.rand() < 0.3) this.after(3000, () => this.visitors.has(v.memberId) && this.reviewCompany(v.memberId, booth.id, 3 + Math.round(this.rand() * 2)));
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

  /** One step toward `goal`, riding the lift when it is on another floor. False once arrived. */
  private walk(v: FairVisitor, route: { path: Point[] | null }, goal: Goal, step: number): boolean {
    const floor = this.floor(v.floorId);
    const viaLift = v.floorId !== goal.floorId;
    const legEnd = viaLift ? LIFT_FRONT : goal;
    if (!route.path) route.path = findPath(floor, v, legEnd) ?? [legEnd];
    let next = route.path[0];
    while (next && Math.hypot(next.x - v.x, next.y - v.y) < 0.05) {
      route.path.shift();
      next = route.path[0];
    }
    if (!next) {
      route.path = null;
      if (!viaLift) return false;
      v.floorId = goal.floorId;
      v.x = LIFT_FRONT.x;
      v.y = LIFT_FRONT.y;
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
}

export const remoteId = (peerId: string) => `net:${peerId}`;
export const recruiterId = (boothId: string) => `rec-${boothId}`;

export const roomStaffId = (roomId: string) => `room-${roomId}`;
export const stallStaffId = (stallId: string) => `stall-${stallId}`;
export const promoterId = (id: string) => `npc-${id}`;

const FEEDBACK = [
  "Belum sesuai kebutuhan kami saat ini.",
  "Profilmu menarik, tapi pengalamannya belum cukup untuk posisi ini.",
  "Lumayan! Lengkapi CV dan portofolio supaya lebih kuat.",
  "Bagus, kami ingin ngobrol lebih lanjut.",
  "Kandidat yang sangat kuat, kami tunggu di interview!",
];

function freshPlayer(): PlayerState {
  return { coins: START_COINS, txns: [{ at: 0, amount: START_COINS, reason: "Koin sambutan" }], vouchers: [], tickets: [], xp: 0, psych: [], seminars: [], dailyOn: null, meals: 0, verified: false };
}

/** Reviews a company had before today, made up from its id so every visitor sees the same. */
export function seededReviews(boothId: string) {
  let h = 2166136261;
  for (const ch of boothId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const count = 6 + (h % 29);
  const average = 3.5 + ((h >>> 8) % 14) / 10;
  return { count, sum: Math.round(count * average) };
}

