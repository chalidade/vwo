// In-browser job fair for the static demo: company booths with recruiters, the organisers'
// info desk, bot job seekers walking from booth to booth, and the applications they send.
import {
  type AvatarState,
  COIN_STAND_SPOTS,
  type CompanyBooth,
  type JobPosting,
  type Facing,
  type FairRoom,
  type FairFloorInfo,
  type FairStop,
  type FloorView,
  DEMO_JOB_FAIR,
  LOUNGE,
  LOUNGE_PLANS,
  loungeBoardSpot,
  loungeSpot,
  safeImage,
  safeUrl,
  STALL_SLOTS,
  buildFairRoom,
  type FoodStall,
  type JobFairView,
  SPONSOR_H,
  SPONSOR_W,
  boothSpot,
  boothHasGate,
  buildJobFairFloor,
  buildJobFairFloors,
  type BoothMedia,
  type BoothTheme,
  type Promoter,
  type SponsorView,
  fairFloorId,
  hallLevel,
  infoDeskOn,
  hallName,
  fairFloorIndex,
  LIFT_FRONT,
  fairRoomFloorId,
  fairStops,
  openJobs,
  stallSlot,
  stallSpot,
  facingFor,
  findPath,
  isBlocked,
  type FairApplicationOut,
} from "@vwo/shared";
import {
  APPLY_COST,
  CAREER_ARTICLES,
  DAILY_COINS,
  FOOD_VOUCHERS,
  GAME_DAILY_CAP,
  MISSIONS_BONUS,
  type MissionKind,
  SEMINARS,
  START_COINS,
  VERIFY_COST,
  XP,
  type VoucherKind,
  levelOf,
  streakBonus,
  todaysMissions,
  PSYCH_MINUTES,
  PSYCH_PASS,
  PSYCH_TEST,
  type PsychQuestion,
  type SeminarSession,
} from "./fair/content";
import { ACCESSORY_PRODUCTS, BOT_REPLIES, VIP_INCLUDED, productOf } from "./fair/company";
import { FLOOR_SLOTS } from "@vwo/ui";

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

export type ApplicationStatus = "Terkirim" | "Dilihat" | "Shortlist" | "Diundang interview" | "Diterima" | "Belum cocok";

/** An interview the company scheduled from its portal. */
export interface Interview {
  at: number;
  mode: string;
  /** Where, or the call link. */
  place?: string;
  note?: string;
  /** The applicant's answer to the invitation. */
  reply?: "hadir" | "jadwal-ulang";
}

/** A notification between an applicant and a company's HR, kept with the saved state so the
 *  portal and the job fair see each other's in any open tab. */
export interface FairNotif {
  id: string;
  at: number;
  /** PLAYER_ID for the job seeker, or a booth id for that company's HR. */
  to: string;
  appId?: string;
  kind: "apply" | "chat" | "status" | "interview" | "call" | "confirm" | "rating";
  text: string;
  read?: boolean;
}

export const NOTIF_ICON: Record<FairNotif["kind"], string> = { apply: "📨", chat: "💬", status: "📋", interview: "📅", call: "📞", confirm: "✅", rating: "⭐" };

/** A chat message between the company and the applicant about one application. */
export interface AppMessage {
  at: number;
  from: "company" | "seeker";
  text: string;
}

export interface CallLog {
  at: number;
  kind: "video" | "voice";
  answered: boolean;
  seconds: number;
}

/** What the organiser changed: booths added or taken out, ads, announcements, rooms. */
export interface OrgState {
  /** Event booths the organiser took out. */
  removed: string[];
  /** Booths the organiser added in free slots. */
  added: CompanyBooth[];
  /** Promoter NPCs (standing and walking), when the organiser changed the list. */
  promoters?: Promoter[];
  /** Sponsors, when the organiser edited them. */
  sponsors?: SponsorView[];
  announcement?: { text: string; at: number };
  psych?: PsychConfig;
  seminars?: SeminarSession[];
  /** How many of the organiser's walking promoters are out at once. Unset: all of them. */
  walkers?: number;
  /** Company portal PINs the organiser set or a booking created. Others use a default PIN. */
  pins?: Record<string, string>;
  /** Empty stands companies booked and paid for themselves. */
  bookings?: StandBooking[];
  /** The banner on each hall's back wall: one title for the event, a second line per floor. */
  banner?: { title?: string; subtitles?: string[] };
  /** The Aula's rundown, when the organiser edited it. */
  rundown?: AulaEvent[];
  /** Food court stalls per room, when the organiser added or removed any. */
  stalls?: Record<string, FoodStall[]>;
  /** The booth floors, when the organiser added, removed or renamed any. */
  halls?: FairFloorInfo[];
  /** Room floors the organiser switched off (by room id). */
  hiddenRooms?: string[];
  /** Entry price in coins per floor id, when the organiser changed it. 0 is free. */
  prices?: Record<string, number>;
  /** 2 once positions were saved for the 46-tile halls; older saves used 38-tile halls. 3 once
   *  promoters' levels follow the floor order with the Aula on Lantai 1. */
  layout?: number;
}

/** One item on the Aula's rundown: an opening speech, a talk show, a door prize. */
export interface AulaEvent {
  id: string;
  /** "09.00" */
  start: string;
  end: string;
  title: string;
  /** Who is on stage. */
  host: string;
  /** Where, when it is not the Aula stage itself (e.g. "Ruang Seminar · Lantai 5"). */
  place?: string;
  kind: "sambutan" | "talkshow" | "hiburan" | "doorprize" | "info";
}

/** How many notifications the demo keeps for each person or company. */
const INBOX_PER = 40;

/** Keep the newest notifications of everyone, so busy companies don't push out the seeker's. */
function trimInbox(list: FairNotif[]) {
  const seen = new Map<string, number>();
  const keep = list.filter((n) => {
    const k = (seen.get(n.to) ?? 0) + 1;
    seen.set(n.to, k);
    return k <= INBOX_PER;
  });
  list.splice(0, list.length, ...keep);
}

/** The day's programme in the Aula until the organiser writes its own. */
export const DEFAULT_RUNDOWN: AulaEvent[] = [
  { id: "reg", start: "08.00", end: "09.00", title: "Registrasi & pembukaan pintu", host: "Panitia", kind: "info" },
  { id: "buka", start: "09.00", end: "09.20", title: "Sambutan Ketua Panitia", host: "Ibu Ratna Wijaya", kind: "sambutan" },
  { id: "sponsor", start: "09.20", end: "09.40", title: "Sambutan Sponsor Utama Telko Nusa", host: "Bapak Hendra", kind: "sambutan" },
  { id: "pita", start: "09.40", end: "10.00", title: "Pembukaan resmi & potong pita", host: "Panitia & sponsor", kind: "sambutan" },
  { id: "talk1", start: "10.00", end: "11.00", title: "Talkshow: Karier Pertama di 2026", host: "HR Nusantara Tech & Kopi Kita", kind: "talkshow" },
  { id: "seminar", start: "11.00", end: "12.00", title: "Seminar CV & interview", host: "Pak Arif", place: "Ruang Seminar · Lantai 5", kind: "info" },
  { id: "rehat", start: "12.00", end: "13.00", title: "Istirahat, makan siang di Food Court", host: "Lantai 8", kind: "info" },
  { id: "musik", start: "13.00", end: "13.45", title: "Hiburan akustik", host: "Band Kampus", kind: "hiburan" },
  { id: "talk2", start: "13.45", end: "15.00", title: "Talkshow: Kerja Remote dan Freelance", host: "Komunitas Kerja Jarak Jauh", kind: "talkshow" },
  { id: "dp", start: "15.00", end: "15.45", title: "Undian door prize", host: "MC Rara", kind: "doorprize" },
  { id: "tutup", start: "15.45", end: "16.30", title: "Penutupan & foto bersama", host: "Panitia", kind: "sambutan" },
];

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(/[.:]/).map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** The item on stage at `now`, the one after it, and whether the day is over. */
export function aulaNow(list: AulaEvent[], now = new Date()) {
  const t = now.getHours() * 60 + now.getMinutes();
  const current = list.find((e) => minutesOf(e.start) <= t && t < minutesOf(e.end)) ?? null;
  const next = list.find((e) => minutesOf(e.start) > t) ?? null;
  return { current, next, over: !current && !next && list.length > 0 };
}

/** The halls grew from 38 to 46 tiles so VIP stands have room for their wings: move positions saved
 *  for the old halls to the same place in the new ones. Booth slots map exactly; anything else keeps
 *  its place relative to the booths around it. */
export function migrateHallX(x: number) {
  const exact: Record<number, number> = { 1: 3, 16: 20, 31: 37, 11.05: 14.05, 26.05: 31.05 };
  if (x in exact) return exact[x]!;
  if (x < 7) return x + 2;
  if (x < 16) return 9 + ((x - 7) * 11) / 9;
  if (x < 22) return x + 4;
  if (x < 31) return 26 + ((x - 22) * 11) / 9;
  return x + 6;
}

/** Promoter levels before the Aula moved to Lantai 1: halls 0–2, then Aula, food court, seminar,
 *  psikotes, lounge. Now: Aula, halls 1–3, seminar, psikotes, lounge, food court. */
const LEVEL_V3: Record<number, number> = { 0: 1, 1: 2, 2: 3, 3: 0, 4: 7, 5: 4, 6: 5, 7: 6 };

function migrateOrg(org: OrgState): OrgState {
  if (org.layout === 3) return org;
  if (org.layout === 2) return { ...org, layout: 3, ...(org.promoters ? { promoters: org.promoters.map((p) => ({ ...p, level: LEVEL_V3[p.level] ?? p.level })) } : {}) };
  return migrateOrg({
    ...org,
    layout: 2,
    added: org.added.map((b) => ({ ...b, x: migrateHallX(b.x) })),
    ...(org.sponsors ? { sponsors: org.sponsors.map((sp) => ({ ...sp, x: migrateHallX(sp.x) })) } : {}),
    // Rooms moved up a floor for the Aula and grew by 8 tiles, 4 on each side.
    ...(org.promoters ? { promoters: org.promoters.map((p) => (p.level >= 3 ? { ...p, level: p.level + 1, x: p.x + 4 } : { ...p, x: migrateHallX(p.x) })) } : {}),
  });
}

/** A company booking an empty stand from the hall map. Payment is a demo. */
export interface StandBooking {
  id: string;
  boothId: string;
  company: string;
  contact: string;
  email: string;
  tier: "premium" | "regular";
  price: number;
  method: string;
  at: number;
}

/** Live: a stand a company booked through the server. The booking and PIN come only to the organiser. */
export interface BookedBooth {
  booth: CompanyBooth;
  booking?: StandBooking;
  pin?: string;
}

/** Stand prices for a booking, in rupiah. */
/** What renting an empty food court stand costs a business, per event (demo payment). */
export const STALL_PRICE = 750_000;

export const STAND_PRICES = { regular: 7_500_000, premium: 15_000_000 } as const;

/** The PIN a company uses to open its portal until the organiser sets another. */
export function defaultPin(boothId: string) {
  let h = 7;
  for (const c of boothId) h = (h * 131 + c.charCodeAt(0)) % 9000;
  return String(1000 + h);
}

export interface PsychConfig {
  questions: PsychQuestion[];
  minutes: number;
  /** Share of right answers needed for the certificate, 0–1. */
  pass: number;
}

/** Where a booth can stand on a hall floor: three columns, two rows. */
export const BOOTH_SLOTS = [3, 20, 37].flatMap((x) => [0.4, 9.4].map((y) => ({ x, y })));

/** Paid booth decorations visitors can use, and what happened. */
export type AccessoryResult = { ok: true; text: string; voucher?: Voucher; coins?: number } | { ok: false; text: string };

/** What a company changed and bought in its portal. */
export interface CompanyState {
  /** Booth fields the company edited, applied over the event's data. */
  edits: Partial<CompanyBooth>;
  /** Paid products (VIP, decorations). */
  owned: string[];
  invoices: CompanyInvoice[];
}

export interface CompanyInvoice {
  id: string;
  no: string;
  at: number;
  items: { id: string; name: string; price: number }[];
  total: number;
  status: "Belum dibayar" | "Lunas" | "Dibatalkan";
  method?: string;
  paidAt?: number;
}

/** Booth fields a company may change itself; position, floor and tier belong to the organiser. */
const EDITABLE = ["company", "tagline", "industry", "logo", "logoImg", "color", "recruiter", "about", "faq", "jobs", "website", "email", "phone", "address", "founded", "employees", "socials", "benefits", "theme", "accessories", "ticker", "vipStyle", "vipHeadline", "callouts", "media", "promoter"] as const;
export type BoothEdit = Partial<Pick<CompanyBooth, (typeof EDITABLE)[number]>>;

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
  /** From the applicant's profile when they applied. */
  headline?: string;
  education?: string;
  skills?: string;
  city?: string;
  /** The applicant's profile photo when they applied (a small inline JPEG). */
  photo?: string;
  /** The company's private notes. */
  notes?: string;
  interview?: Interview;
  messages?: AppMessage[];
  calls?: CallLog[];
  /** Last change, so two open tabs keep the newest copy. */
  updatedAt?: number;
  /** Live: the server's last change we took, on the server's clock, so a fast device clock can't hide newer answers. */
  serverAt?: number;
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
  /** Days in a row the free daily coins were claimed. */
  streak?: number;
  /** Career articles read to the end in the sofa's reading corner. */
  read?: string[];
  /** Roadmap steps ticked off, per article. */
  roadmap?: Record<string, string[]>;
  /** Today's missions and mini game earnings; reset when the day changes. */
  daily?: DailyState;
  /** Booth decoration rewards taken, by key, with the day they were taken. */
  claims?: Record<string, string>;
}

export interface DailyState {
  day: string;
  counts: Partial<Record<MissionKind, number>>;
  claimed: string[];
  bonus: boolean;
  gameCoins: number;
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
  /** What each company changed and bought in the company portal, by booth id. */
  company?: Record<string, CompanyState>;
  /** The organiser's changes. */
  org?: OrgState;
  /** Notifications between applicants and HR. */
  inbox?: FairNotif[];
}

/** The live site keeps this per account on the server. */
export interface PlayerProgress {
  player: PlayerState;
  /** Booths stamped on the player's card. */
  stamps: string[];
  /** The player's own notifications. */
  inbox: FairNotif[];
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
  aula: ["👏👏👏", "Seru acaranya!", "Semoga dapat door prize 🎁", "Ketemu di meeting point ya", "Abis ini talkshow"],
  konsultasi: ["Sofanya empuk 😌", "Nunggu giliran konsultasi", "📞 Halo?", "Tadi dapat tips CV bagus", "Ngobrol yuk!", "Pak Hendra baik banget"],
};
/** Short exchanges between two job seekers standing or sitting near each other, per kind of floor. */
export const CONVOS: Record<FairRoom["kind"] | "hall", string[][]> = {
  hall: [
    ["Kamu udah lamar ke mana aja?", "Baru dua stand, kamu?", "Aku tiga, semoga ada yang nyangkut 🤞"],
    ["Stand yang VIP itu keren ya", "Iya, ada layar videonya!"],
    ["CV-mu satu halaman?", "Iya, katanya recruiter suka yang ringkas"],
    ["Ada lowongan remote nggak sih?", "Coba cek stand Kreatif di Lantai 3"],
    ["Fresh graduate bisa lamar di sini?", "Bisa, banyak yang program management trainee"],
    ["Antre di stand sebelah panjang banget", "Lamar online di HP aja, lebih cepat"],
    ["Gaji yang ditulis itu nett atau gross?", "Tanya langsung ke recruiternya aja"],
    ["Habis ini mau ke seminar?", "Iya, Lantai 5 jam sebelas", "Bareng yuk!"],
  ],
  aula: [
    ["Acaranya mulai jam berapa?", "Lihat papan rundown di kiri", "Oh iya, makasih!"],
    ["Kamu dari kampus mana?", "Dari Bandung, kamu?", "Bekasi 👋"],
    ["Semoga dapat door prize ya", "Amin! Hadiahnya laptop katanya 😮"],
    ["Ketemu teman di meeting point ya", "Oke, aku tunggu di tiang hijau"],
  ],
  seminar: [
    ["Metode STAR itu apa sih?", "Situation, Task, Action, Result", "Oh, buat jawab interview ya"],
    ["Slide-nya bisa diminta nggak?", "Katanya dibagi setelah sesi"],
    ["Pembicaranya enak jelasinnya", "Iya, praktis banget"],
  ],
  psikotes: [
    ["Soal deret angkanya susah", "Pola kali dua kayaknya", "Ooh iya!"],
    ["Waktunya cukup nggak?", "Kerjakan yang gampang dulu"],
  ],
  foodcourt: [
    ["Enak baksonya?", "Enak, kuahnya mantap", "Aku pesan juga deh"],
    ["Pakai voucher dapat diskon lho", "Serius? Beli pakai koin ya?"],
    ["Habis makan lanjut lamar lagi", "Semangat! Aku mau ke psikotes"],
    ["Kopi susunya manis pas", "Buat begadang revisi CV 😅"],
  ],
  konsultasi: [
    ["Tadi konsultasi sama siapa?", "Kak Maya, soal portofolio", "Bagus nggak?", "Bagus, langsung dikasih contoh"],
    ["Teleponnya bayar berapa koin?", "Sepuluh menit sepuluh koin"],
    ["Sofanya nyaman ya", "Iya, betah nunggu di sini 😌"],
  ],
};

const READING = ["Hmm, menarik...", "Gajinya lumayan!", "Cocok nih sama aku", "Catat dulu 📝", "Wah, banyak lowongan"];
const CALLOUTS = [(job: string) => `Kami cari ${job}! Mampir yuk!`, () => "Ayo tanya-tanya dulu!", () => "Ada merchandise buat pelamar 🎁", (job: string) => `Lowongan ${job}, langsung apply di sini!`];

/** A paid floor: a room or a booth floor the organiser put a price on. */
export interface FloorPass {
  /** What the ticket is stored under: the room id, or the booth floor's id. */
  id: string;
  name: string;
  tagline: string;
  price: number;
  /** Who sells the ticket. */
  staff: string;
  room?: FairRoom;
}

/** The organiser behind a floor's info desk. */
export const infoStaffId = (fair: JobFairView, floorId: string) => (floorId === fairFloorId(fair, 0) ? "fair-info" : `info:${floorId}`);

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
  /** Company portal data per booth. */
  readonly company = new Map<string, CompanyState>();
  /** The event's booths as published, before any company edits. */
  private readonly original: Map<string, CompanyBooth>;
  private readonly originalPromoters: Promoter[];
  private readonly originalSponsors: SponsorView[];
  /** Food court stalls as published, per room, before the organiser added or removed any. */
  private readonly originalStalls: Map<string, FoodStall[]>;
  /** The building as published: booth floors, room floors and the level of the first booth floor. */
  private readonly originalHalls: FairFloorInfo[];
  private readonly originalRooms: FairRoom[];
  private readonly originalHallBase: number;
  /** The organiser's changes. */
  org: OrgState = { removed: [], added: [] };
  /** Live: booths that came from a server booking. */
  private booked = new Set<string>();
  /** Walking promoters: where they are heading and who they last talked to. */
  private walkers = new Map<string, { path: Point[] | null; target: Goal | null; until: number; met: Map<string, number>; pitching: string | null }>();
  readonly events: FairEvent[] = [];
  /** Visits counted per booth (a visitor stopping at its desk or banner). */
  readonly visits = new Map<string, number>();
  /** Booths each visitor has stopped by, for their stamp card. */
  readonly visitedBy = new Map<string, Set<string>>();
  /** How often each sponsor's banner was opened or read. */
  readonly sponsorViews = new Map<string, number>();
  readonly bubbles = new Map<string, { text: string; until: number }>();
  private bots: Bot[] = [];
  /** How many bot seekers walk the floors at once. None in the live app, where every visitor is real. */
  maxBots = MAX_BOTS;
  /** Bot guests fill the rooms and demo companies answer applications by themselves.
   *  Off in the live app, where every applicant and every company is a real person. */
  simulated = true;
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
    // Companies and the organiser edit booths, ads and sponsors, so work on a copy of the event data.
    this.original = new Map(fair.booths.map((b) => [b.id, structuredClone(b)]));
    this.originalPromoters = structuredClone(fair.promoters);
    this.originalSponsors = structuredClone(fair.sponsors);
    this.originalStalls = new Map(fair.rooms.map((r) => [r.id, structuredClone(r.stalls ?? [])]));
    this.originalHalls = structuredClone(fair.floors);
    this.originalRooms = structuredClone(fair.rooms);
    this.originalHallBase = fair.hallBase ?? 0;
    this.fair = {
      ...fair,
      floors: structuredClone(fair.floors),
      booths: fair.booths.map((b) => structuredClone(b)),
      promoters: structuredClone(fair.promoters),
      sponsors: structuredClone(fair.sponsors),
      rooms: structuredClone(fair.rooms),
    };
    this.floors = buildJobFairFloors(this.fair);
    this.stops = fairStops(this.fair);
    this.staff = [];
    this.rebuildStaff();
    this.nextBotAt = this.now() + 400;
    this.nextCalloutAt = this.now() + 5000;
    this.restore();
  }

  private dirty = false;

  private restore() {
    const saved = this.storage?.load();
    if (!saved || (saved.version !== 1 && saved.version !== 2)) return;
    if (saved.player) Object.assign(this.player, freshPlayer(), saved.player);
    this.loadOrg(saved.org);
    this.loadCompany(saved.company);
    for (const [k, list] of Object.entries(saved.reviews ?? {})) if (this.booth(k)) this.reviews.set(k, list);
    for (const a of saved.applications ?? []) {
      if (!this.booth(a.boothId)) continue;
      this.applications.push({ ...a, status: a.status === "Terkirim" ? "Dilihat" : a.status });
    }
    for (const [k, n] of Object.entries(saved.visits ?? {})) this.visits.set(k, n);
    for (const [k, n] of Object.entries(saved.sponsorViews ?? {})) this.sponsorViews.set(k, n);
    for (const [k, a] of Object.entries(saved.ads ?? {})) this.ads.set(k, a);
    for (const [k, ids] of Object.entries(saved.visitedBy ?? {})) this.visitedBy.set(k, new Set(ids));
    this.inbox.splice(0, this.inbox.length, ...(saved.inbox ?? []));
  }

  /** Everyone who stands at a fixed spot or walks for the organiser: recruiters, desk staff, room hosts, promoters. */
  private rebuildStaff() {
    const fair = this.fair;
    const old = new Map(this.staff.map((x) => [x.id, x]));
    const promoFloor = (p: Promoter) => this.stops.find((st) => st.level === p.level)?.floorId ?? this.floors[0]!.id;
    const next: FairStaff[] = [
      ...fair.booths.map((b) => ({ id: recruiterId(b.id), name: b.recruiter, boothId: b.id, floorId: fairFloorId(fair, b.floor), ...boothSpot(b, "recruiter"), facing: "front" as Facing })),
      // An info desk on every floor; the entrance one keeps its old id.
      ...this.stops.map((st): FairStaff => {
        const d = infoDeskOn(fair, st.floorId);
        return { id: infoStaffId(fair, st.floorId), name: d.staff, boothId: null, floorId: st.floorId, x: d.x + d.width / 2, y: d.y - 0.45, facing: "front" };
      }),
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
            ...(room.stalls ?? []).map((st, i) => ({ id: stallStaffId(st.id), name: st.vendor, boothId: null, floorId, ...stallSpot(stallSlot(st, i), "vendor"), facing: "front" as Facing })),
          ];
        if (room.kind === "aula") return [{ ...host, x: room.width / 2 - 4, y: 2.3 }];
        if (room.kind === "konsultasi")
          return [
            { ...host, x: loungeBoardSpot().x - 2.2, y: loungeBoardSpot().y },
            ...(room.consultants ?? []).slice(0, LOUNGE.pods.length).map((c, i) => ({ id: consultantId(c.id), name: c.name, boothId: null, floorId, ...loungeSpot(i, "consultant"), facing: "front" as Facing })),
          ];
        return [{ ...host, x: room.width / 2, y: room.kind === "seminar" ? 2.0 : 0.85 }];
      }),
      ...fair.promoters.map((p) => {
        const id = promoterId(p.id);
        const was = old.get(id);
        // A walker keeps walking from where it is; a standing promoter goes back to its spot.
        if (p.walks && was && was.floorId === promoFloor(p)) return { ...was, name: `📣 ${p.brand}` };
        return { id, name: `📣 ${p.brand}`, boothId: null, floorId: promoFloor(p), x: p.x, y: p.y, facing: "front" as Facing };
      }),
    ];
    this.staff.splice(0, this.staff.length, ...next);
    for (const id of [...this.walkers.keys()]) if (!fair.promoters.some((p) => p.walks && p.id === id)) this.walkers.delete(id);
  }

  /** Apply the organiser's changes: which booths stand where, the ads, the sponsors. */
  private loadOrg(org: OrgState | undefined) {
    this.org = org ? migrateOrg(structuredClone(org)) : { removed: [], added: [], layout: 3 };
    this.applyBuilding();
    const before = this.fair.booths.map((b) => b.id).join() + this.fair.sponsors.map((x) => x.id).join();
    const base = [...[...this.original.values()].filter((b) => !this.org.removed.includes(b.id)), ...this.org.added];
    const byId = new Map(this.fair.booths.map((b) => [b.id, b]));
    // Keep the same objects for booths that stay, so open dialogs keep pointing at them.
    const booths = base.map((b) => {
      const mine = byId.get(b.id);
      if (!mine) return structuredClone(b);
      for (const k of Object.keys(mine)) delete (mine as unknown as Record<string, unknown>)[k];
      return Object.assign(mine, structuredClone(b));
    });
    this.fair.booths.splice(0, this.fair.booths.length, ...booths);
    // Published promoters stand on the published levels: move them with their floor, drop them with it.
    const published = () => {
      const now = this.levelsByKey(), was = this.publishedLevels();
      return structuredClone(this.originalPromoters).flatMap((p) => {
        const key = [...was].find(([, l]) => l === p.level)?.[0];
        const level = key ? now.get(key) : undefined;
        return level === undefined ? [] : [{ ...p, level }];
      });
    };
    const active = (this.org.promoters ? structuredClone(this.org.promoters) : published()).filter((p) => p.active !== false && this.stops.some((st) => st.level === p.level));
    // The organiser caps how many walkers are out; the first ones in the list go first.
    let walking = 0;
    const cap = this.org.walkers ?? Infinity;
    this.fair.promoters.splice(0, this.fair.promoters.length, ...active.filter((p) => !p.walks || walking++ < cap));
    this.fair.sponsors.splice(0, this.fair.sponsors.length, ...structuredClone(this.org.sponsors ?? this.originalSponsors));
    const after = this.fair.booths.map((b) => b.id).join() + this.fair.sponsors.map((x) => x.id).join();
    if (before !== after) {
      this.fair.floors.forEach((_, i) => (this.floors[i] = buildJobFairFloor(this.fair, i)));
      this.floorSig = "";
    }
    // Food court stalls: the organiser's list replaces the published one; rebuild the floor when it changed.
    for (const room of this.fair.rooms) {
      if (!room.stalls) continue;
      const next = structuredClone(this.org.stalls?.[room.id] ?? this.originalStalls.get(room.id) ?? []);
      const sig = (l: FoodStall[]) => l.map((st, i) => `${st.id}@${stallSlot(st, i)}`).join();
      const changed = sig(next) !== sig(room.stalls);
      room.stalls.splice(0, room.stalls.length, ...next);
      if (changed) {
        const i = this.floors.findIndex((f) => f.id === fairRoomFloorId(this.fair, room.id));
        if (i >= 0) this.floors[i] = buildFairRoom(this.fair, room);
      }
    }
    this.rebuildStaff();
  }

  private saveOrg() {
    this.loadOrg(this.org);
    this.loadCompany(Object.fromEntries(this.company));
    this.persist();
    this.emit();
  }

  // ---- Building: which floors there are, in what order, and what they cost ------------

  /** Every floor by key ("hall:0", "room:aula") and its level, as published. */
  private publishedLevels() {
    const m = new Map<string, number>();
    this.originalHalls.forEach((_, i) => m.set(`hall:${i}`, this.originalHallBase + i));
    for (const r of this.originalRooms) m.set(`room:${r.id}`, r.level);
    return m;
  }

  /** Every floor by key and its level now. */
  private levelsByKey() {
    const m = new Map<string, number>();
    this.fair.floors.forEach((_, i) => m.set(`hall:${i}`, hallLevel(this.fair, i)));
    for (const r of this.fair.rooms) m.set(`room:${r.id}`, r.level);
    return m;
  }

  /** Lay the floors out from the organiser's choices: the published order, with the booth floors as
   *  one block where the first one was, switched-off rooms left out, and no gaps between levels. */
  private applyBuilding() {
    const halls = this.org.halls?.length ? this.org.halls : this.originalHalls;
    const hidden = new Set(this.org.hiddenRooms ?? []);
    const order: string[] = [];
    for (const [key] of [...this.publishedLevels()].sort((a, b) => a[1] - b[1])) {
      if (key === "hall:0") halls.forEach((_, i) => order.push(`hall:${i}`));
      else if (key.startsWith("room:") && !hidden.has(key.slice(5))) order.push(key);
    }
    const levelOf = (key: string) => order.indexOf(key);
    const sig = () => [...this.levelsByKey()].map(([k, l]) => `${k}=${l}`).join() + this.fair.floors.map((f) => f.theme).join();
    const before = sig();
    this.fair.hallBase = levelOf("hall:0");
    this.fair.floors.splice(0, this.fair.floors.length, ...halls.map((h, i) => ({ name: `Lantai ${this.fair.hallBase! + i + 1}`, theme: h.theme })));
    const mine = new Map(this.fair.rooms.map((r) => [r.id, r]));
    const rooms = this.originalRooms
      .filter((r) => !hidden.has(r.id))
      .map((r) => {
        // Keep the same room objects, so open dialogs and stall lists keep pointing at them.
        const room = mine.get(r.id) ?? structuredClone(r);
        room.level = levelOf(`room:${r.id}`);
        room.price = this.org.prices?.[fairRoomFloorId(this.fair, r.id)] ?? r.price;
        return room;
      });
    this.fair.rooms.splice(0, this.fair.rooms.length, ...rooms);
    if (before === sig() || !this.floors) return;
    this.floors.splice(0, this.floors.length, ...buildJobFairFloors(this.fair));
    this.stops.splice(0, this.stops.length, ...fairStops(this.fair));
    this.floorSig = "";
    // Whoever stood on a floor that is gone goes back to the entrance; the bots just leave.
    const ids = new Set(this.floors.map((f) => f.id));
    for (const v of [...this.visitors.values()]) {
      if (v.isBot) this.leave(v.memberId);
      else if (!ids.has(v.floorId)) Object.assign(v, { floorId: this.stops[0]!.floorId, x: this.fair.spawn.x, y: this.fair.spawn.y, seatId: null });
    }
  }

  /** Change the building and move the organiser's promoters along with their floors. */
  private rebuild(change: () => void) {
    const was = this.levelsByKey();
    change();
    const promoters = this.org.promoters;
    this.saveOrg();
    if (!promoters) return;
    const now = this.levelsByKey();
    this.org.promoters = promoters.map((p) => {
      const key = [...was].find(([, l]) => l === p.level)?.[0];
      const level = key ? now.get(key) : undefined;
      return level === undefined ? { ...p, active: false } : { ...p, level };
    });
    this.saveOrg();
  }

  /** Add an empty booth floor above the others. Companies can book its stands right away. */
  addHall(theme: string) {
    const halls = structuredClone(this.fair.floors);
    if (halls.length >= 8) return false;
    this.rebuild(() => (this.org.halls = [...halls, { name: "", theme: theme.trim().slice(0, 40) || "Lantai baru" }]));
    return true;
  }

  /** Why the top booth floor cannot be taken out yet, or null when it can. */
  removeHallBlocker(): string | null {
    const i = this.fair.floors.length - 1;
    if (i <= 0) return "Minimal harus ada satu lantai booth.";
    const n = this.fair.booths.filter((b) => b.floor === i).length;
    if (n) return `Masih ada ${n} stand di lantai ini. Pindahkan atau hapus dulu di tab Stand.`;
    if (this.fair.sponsors.some((sp) => sp.floor === i)) return "Masih ada sponsor di lantai ini.";
    if (this.fair.coinStand.floor === i) return "Stand koin ada di lantai ini.";
    return null;
  }

  /** Take out the top booth floor, when it is empty. */
  removeHall() {
    if (this.removeHallBlocker()) return false;
    const halls = structuredClone(this.fair.floors).slice(0, -1);
    const prices = { ...this.org.prices };
    delete prices[fairFloorId(this.fair, halls.length)];
    this.rebuild(() => {
      this.org.halls = halls;
      this.org.prices = prices;
    });
    return true;
  }

  renameHall(i: number, theme: string) {
    if (!this.fair.floors[i]) return;
    this.org.halls = structuredClone(this.fair.floors).map((h, j) => (j === i ? { ...h, theme: theme.trim().slice(0, 40) || h.theme } : h));
    this.saveOrg();
  }

  /** Switch a room floor (food court, seminar...) off or back on. */
  setRoomHidden(roomId: string, hidden: boolean) {
    const list = new Set(this.org.hiddenRooms ?? []);
    if (hidden) list.add(roomId);
    else list.delete(roomId);
    // The floor everyone comes in on stays, so there is always somewhere to arrive.
    if (hidden && this.stops.length <= 1) return;
    this.rebuild(() => (this.org.hiddenRooms = [...list]));
  }

  /** Rooms the organiser switched off. */
  hiddenRooms() {
    return this.originalRooms.filter((r) => this.org.hiddenRooms?.includes(r.id));
  }

  /** Set what entering a floor costs, in coins. The floor everyone arrives on stays free. */
  setFloorPrice(floorId: string, coins: number) {
    if (floorId === this.stops[0]?.floorId) return;
    this.org.prices = { ...this.org.prices, [floorId]: Math.max(0, Math.min(500, Math.round(coins) || 0)) };
    this.saveOrg();
  }

  /** What entering a floor costs: rooms carry their price, booth floors are free unless the organiser set one. */
  floorPrice(floorId: string) {
    if (floorId === this.stops[0]?.floorId) return 0;
    const room = this.roomOf(floorId);
    return room ? room.price : (this.org.prices?.[floorId] ?? 0);
  }

  /** The ticket a floor asks for, or null when it is free. Rooms use their own id, booth floors their floor id. */
  passFor(floorId: string): FloorPass | null {
    if (!this.floorPrice(floorId)) return null;
    const room = this.roomOf(floorId);
    if (room) return { id: room.id, name: room.name, tagline: room.tagline, price: room.price, staff: room.staff.name, room };
    const i = fairFloorIndex(floorId);
    const hall = this.fair.floors[i];
    if (!hall) return null;
    return { id: floorId, name: `${hallName(this.fair, i)} · ${hall.theme}`, tagline: `Lantai khusus ${hall.theme}`, price: this.floorPrice(floorId), staff: infoDeskOn(this.fair, floorId).staff };
  }

  // ---- Organiser ----------------------------------------------------------------------

  /** The food court room (the first one, if there are several). */
  foodCourt() {
    return this.fair.rooms.find((r) => r.kind === "foodcourt" && r.stalls);
  }

  /** Free stall places in the food court, by slot number. */
  freeStallSlots(roomId = this.foodCourt()?.id) {
    const room = this.fair.rooms.find((r) => r.id === roomId);
    if (!room?.stalls) return [];
    const taken = new Set(room.stalls.map((st, i) => stallSlot(st, i)));
    return STALL_SLOTS.map((_, i) => i).filter((i) => !taken.has(i));
  }

  private setStalls(roomId: string, list: FoodStall[]) {
    // Pin every stall to its slot, so taking one out leaves the others where they are.
    this.org.stalls = { ...this.org.stalls, [roomId]: list.map((st, i) => ({ ...st, slot: stallSlot(st, i) })) };
    this.saveOrg();
  }

  /** Put a business in a free food court slot (the organiser, or a business renting the stand). */
  addStall(slot: number, input: { name: string; emoji?: string; color?: string; vendor?: string; promo?: string; about?: string; address?: string; hours?: string; website?: string; deal?: { title: string; worth: string; price: number } }, roomId = this.foodCourt()?.id) {
    const room = this.fair.rooms.find((r) => r.id === roomId);
    const name = input.name.trim().slice(0, 40);
    if (!room?.stalls || !name || !this.freeStallSlots(room.id).includes(slot)) return null;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "stan";
    let id = `stall-${slug}`;
    for (let n = 2; room.stalls.some((st) => st.id === id); n++) id = `stall-${slug}-${n}`;
    const deal = input.deal && input.deal.title.trim() && input.deal.price > 0 ? input.deal : null;
    const stall: FoodStall = {
      id,
      slot,
      name,
      emoji: input.emoji?.trim() || "🍽️",
      color: input.color || "#ea580c",
      vendor: input.vendor?.trim().slice(0, 30) || "Penjaga stan",
      promo: input.promo?.trim().slice(0, 80) || `Promo spesial dari ${name}`,
      about: input.about?.trim().slice(0, 300) || "",
      address: input.address?.trim().slice(0, 120) || "",
      hours: input.hours?.trim().slice(0, 40) || "",
      website: safeUrl(input.website ?? "") ?? "",
      rating: 4.5,
      menu: [],
      deals: deal ? [{ id: `${id}-deal`, title: deal.title.trim().slice(0, 60), worth: deal.worth.trim().slice(0, 20) || "-", price: Math.min(200, Math.max(1, Math.round(deal.price))), terms: "Berlaku 30 hari." }] : [],
    };
    this.setStalls(room.id, [...room.stalls, stall]);
    this.log({ type: "room", name: `Stan food court baru: ${name}` });
    return stall;
  }

  /** Take a stall out of the food court; its slot becomes free to rent. */
  removeStall(stallId: string) {
    const room = this.fair.rooms.find((r) => r.stalls?.some((st) => st.id === stallId));
    if (!room?.stalls) return false;
    this.setStalls(room.id, room.stalls.filter((st) => st.id !== stallId));
    return true;
  }

  /** Put the food court back as published. */
  resetStalls(roomId = this.foodCourt()?.id) {
    if (!roomId || !this.org.stalls?.[roomId]) return;
    const { [roomId]: _, ...rest } = this.org.stalls;
    this.org.stalls = rest;
    this.saveOrg();
  }

  /** Empty booth places on the hall floors. */
  freeSlots() {
    return this.fair.floors.flatMap((_, floor) => BOOTH_SLOTS.filter((sl) => !this.fair.booths.some((b) => b.floor === floor && b.x === sl.x && b.y === sl.y)).map((sl) => ({ floor, ...sl })));
  }

  /** Put a new company in a free slot. */
  addBooth(input: { company: string; industry: string; tagline?: string; color: string; logo?: string; recruiter?: string; email?: string; floor: number; x: number; y: number; tier?: "premium" | "regular" }) {
    const name = input.company.trim();
    if (!name || !this.freeSlots().some((sl) => sl.floor === input.floor && sl.x === input.x && sl.y === input.y)) return null;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "stand";
    let id = slug;
    for (let n = 2; this.original.has(id) || this.org.added.some((b) => b.id === id); n++) id = `${slug}-${n}`;
    const booth: CompanyBooth = {
      id,
      company: name,
      tagline: input.tagline?.trim() || `Bergabung bersama ${name}`,
      industry: input.industry.trim() || "Umum",
      logo: (input.logo?.trim() || name.split(/\s+/).map((w) => w[0]).join("")).slice(0, 2).toUpperCase(),
      color: input.color,
      floor: input.floor,
      tier: input.tier ?? "regular",
      x: input.x,
      y: input.y,
      recruiter: input.recruiter?.trim() || "Recruiter",
      ...(input.email?.trim() ? { email: input.email.trim() } : {}),
      about: `${name} membuka lowongan di job fair ini. Profil lengkap diisi perusahaan lewat portal perusahaan.`,
      faq: [{ q: "Bagaimana cara melamar?", a: "Pilih lowongan di banner stand lalu kirim lamaran." }],
      jobs: [{ id: `${id}-staff`, title: "Staff Umum", type: "Full-time", location: "Jakarta", requirements: ["Lulusan SMA/SMK/S1", "Komunikatif"] }],
    };
    this.org.added.push(booth);
    this.saveOrg();
    return booth;
  }

  /** Take a booth out of the event. Its applications go with it. */
  removeBooth(id: string) {
    if (!this.booth(id)) return;
    if (this.org.added.some((b) => b.id === id)) this.org.added = this.org.added.filter((b) => b.id !== id);
    else this.org.removed.push(id);
    // A booking lives on the server on its own: mark it taken out so the next pull doesn't bring it back.
    if (this.booked.has(id) && !this.org.removed.includes(id)) this.org.removed.push(id);
    if (this.org.bookings) this.org.bookings = this.org.bookings.filter((x) => x.boothId !== id);
    this.company.delete(id);
    for (let i = this.applications.length - 1; i >= 0; i--) if (this.applications[i]!.boothId === id) this.applications.splice(i, 1);
    this.saveOrg();
  }

  /** Bring back an event booth the organiser took out, if its slot is still free. */
  restoreBooth(id: string) {
    const b = this.original.get(id);
    if (!b || !this.org.removed.includes(id)) return false;
    if (this.fair.booths.some((x) => x.floor === b.floor && x.x === b.x && x.y === b.y)) return false;
    this.org.removed = this.org.removed.filter((x) => x !== id);
    this.saveOrg();
    return true;
  }

  /** Booths taken out that could come back. */
  removedBooths() {
    return this.org.removed.map((id) => this.original.get(id)!).filter(Boolean);
  }

  /** Add or change a promoter NPC (standing or walking). */
  savePromoter(p: Promoter) {
    const list = structuredClone(this.org.promoters ?? this.originalPromoters);
    const i = list.findIndex((x) => x.id === p.id);
    if (i >= 0) list[i] = p;
    else list.push(p);
    this.org.promoters = list;
    this.saveOrg();
  }

  removePromoter(id: string) {
    this.org.promoters = structuredClone(this.org.promoters ?? this.originalPromoters).filter((p) => p.id !== id);
    this.saveOrg();
  }

  /** How many of the organiser's walking promoters are out at once. */
  walkerLimit() {
    const all = this.allPromoters().filter((p) => p.walks && p.active !== false).length;
    return Math.min(this.org.walkers ?? all, all);
  }

  setWalkerLimit(n: number) {
    this.org.walkers = Math.max(0, Math.round(n));
    this.saveOrg();
  }

  // ---- Company sign-in and stand bookings ---------------------------------------------------

  companyPin(boothId: string) {
    return this.org.pins?.[boothId] ?? defaultPin(boothId);
  }

  /** Whether the organiser or a booking set this booth's PIN. The live server never takes a default PIN. */
  hasCompanyPin(boothId: string) {
    return !!this.org.pins?.[boothId];
  }

  setCompanyPin(boothId: string, pin: string) {
    if (!/^\d{4,6}$/.test(pin)) return false;
    this.org.pins = { ...this.org.pins, [boothId]: pin };
    this.saveOrg();
    return true;
  }

  /** The booth a company code and PIN open, if they match. The code is the booth id. */
  companyLogin(code: string, pin: string) {
    const b = this.booth(code.trim().toLowerCase());
    return b && this.companyPin(b.id) === pin.trim() ? b : undefined;
  }

  bookings() {
    return this.org.bookings ?? [];
  }

  /** A company books an empty stand, pays (demo), and its booth appears on the map with a portal PIN. */
  bookStand(input: { company: string; industry: string; color: string; contact: string; email: string; tier: "premium" | "regular"; method: string; floor: number; x: number; y: number }) {
    const booth = this.addBooth({ company: input.company, industry: input.industry, color: input.color, recruiter: input.contact, email: input.email, floor: input.floor, x: input.x, y: input.y, tier: input.tier });
    if (!booth) return null;
    const pin = String(1000 + Math.floor(this.rand() * 9000));
    this.org.pins = { ...this.org.pins, [booth.id]: pin };
    this.org.bookings = [
      { id: this.newAdId("book"), boothId: booth.id, company: booth.company, contact: input.contact.trim(), email: input.email.trim(), tier: input.tier, price: STAND_PRICES[input.tier], method: input.method, at: this.now() },
      ...(this.org.bookings ?? []),
    ];
    this.saveOrg();
    return { booth: this.booth(booth.id)!, pin };
  }

  /** Every promoter, including those switched off. */
  allPromoters() {
    return this.org.promoters ?? this.originalPromoters;
  }

  newAdId(prefix: string) {
    return `${prefix}-${this.now().toString(36)}${Math.floor(this.rand() * 1000)}`;
  }

  /** Change a sponsor's banner text, tier or link. Position stays. */
  saveSponsor(sp: SponsorView) {
    const list = structuredClone(this.org.sponsors ?? this.originalSponsors);
    const i = list.findIndex((x) => x.id === sp.id);
    if (i < 0) return;
    list[i] = { ...sp, x: list[i]!.x, y: list[i]!.y, floor: list[i]!.floor };
    this.org.sponsors = list;
    this.saveOrg();
  }

  /** What the banner on a hall's back wall says. */
  hallBanner(floor: number) {
    const b = this.org.banner;
    return { title: b?.title?.trim() || this.fair.name, subtitle: b?.subtitles?.[floor]?.trim() || this.floors[floor]?.name || this.fair.floors[floor]?.name || "" };
  }

  setHallBanner(title: string, subtitles: string[]) {
    this.org.banner = { title: title.trim().slice(0, 34), subtitles: subtitles.map((t) => t.trim().slice(0, 70)) };
    this.saveOrg();
  }

  /** A message from the organiser to everyone in the hall. */
  announce(text: string) {
    const t = text.trim().slice(0, 200);
    this.org.announcement = t ? { text: t, at: this.now() } : undefined;
    if (t) this.notices.push(`📢 Panitia: ${t}`);
    this.saveOrg();
  }

  psychConfig(): PsychConfig {
    return this.org.psych ?? { questions: PSYCH_TEST, minutes: PSYCH_MINUTES, pass: PSYCH_PASS };
  }

  savePsych(cfg: PsychConfig) {
    const questions = cfg.questions.filter((q) => q.q.trim() && q.options.filter((o) => o.trim()).length >= 2 && q.answer >= 0 && q.answer < q.options.length);
    if (!questions.length) return false;
    this.org.psych = { questions, minutes: Math.max(1, Math.min(60, Math.round(cfg.minutes))), pass: Math.max(0.1, Math.min(1, cfg.pass)) };
    this.saveOrg();
    return true;
  }

  resetPsych() {
    delete this.org.psych;
    this.saveOrg();
  }

  seminars(): SeminarSession[] {
    return this.org.seminars ?? SEMINARS;
  }

  saveSeminar(sem: SeminarSession) {
    const list = structuredClone(this.seminars());
    const i = list.findIndex((x) => x.id === sem.id);
    if (i >= 0) list[i] = sem;
    else list.push(sem);
    this.org.seminars = list;
    this.saveOrg();
  }

  removeSeminar(id: string) {
    const list = this.seminars().filter((x) => x.id !== id);
    if (!list.length) return;
    this.org.seminars = structuredClone(list);
    this.saveOrg();
  }

  // ---- The Aula's rundown -------------------------------------------------------------

  rundown(): AulaEvent[] {
    return this.org.rundown ?? DEFAULT_RUNDOWN;
  }

  saveRundown(list: AulaEvent[]) {
    const clean = list
      .filter((e) => e.title.trim() && /^\d{2}[.:]\d{2}$/.test(e.start) && /^\d{2}[.:]\d{2}$/.test(e.end))
      .map((e) => ({ ...e, start: e.start.replace(":", "."), end: e.end.replace(":", "."), title: e.title.trim(), host: e.host.trim() }))
      .sort((a, b) => a.start.localeCompare(b.start));
    this.org.rundown = clean;
    this.saveOrg();
    return clean.length;
  }

  resetRundown() {
    delete this.org.rundown;
    this.saveOrg();
  }

  /** What is on the Aula stage now and what comes next, by the clock. */
  aulaNow(now = new Date()) {
    return aulaNow(this.rundown(), now);
  }

  // ---- Booth decorations visitors can use ------------------------------------------------

  /** A visitor uses a booth's paid decoration: watch the video, take a brochure, claim merch, pop a balloon... */
  useAccessory(boothId: string, acc: string, action: "view" | "claim" | "share" = "view"): AccessoryResult {
    const b = this.booth(boothId);
    if (!b || !((b.accessories ?? []).includes(acc) || (acc === "tv" && b.tier === "premium"))) return { ok: false, text: "Aksesoris tidak ada" };
    const key = `acc:${boothId}:${acc}`;
    if (action === "view") {
      this.ad(key, "view");
      return { ok: true, text: "" };
    }
    if (action === "share") {
      this.ad(key, "click");
      return { ok: true, text: "Dibagikan" };
    }
    const claims = (this.player.claims ??= {});
    const today = this.today();
    const ckey = `${acc}:${boothId}`;
    if (acc === "giveaway") {
      const merch = b.media?.merch ?? { name: `Tote bag ${b.company}`, stock: 50 };
      if (claims[ckey]) return { ok: false, text: "Kamu sudah ambil merchandise di stand ini" };
      const given = this.ads.get(key)?.sold ?? 0;
      if (given >= merch.stock) return { ok: false, text: "Yah, merchandise sudah habis" };
      claims[ckey] = today;
      this.ad(key, "sold");
      const v = this.giveVoucher(`🎁 ${merch.name}`, b, "Tunjukkan di stand untuk mengambil");
      this.gainXp(3);
      return { ok: true, text: `${merch.name} jadi milikmu! Ambil di stand dengan menunjukkan voucher.`, voucher: v };
    }
    if (acc === "coffee") {
      if (claims[ckey] === today) return { ok: false, text: "Kopi gratisnya sudah kamu ambil hari ini" };
      claims[ckey] = today;
      this.ad(key, "sold");
      const v = this.giveVoucher(`☕ ${b.media?.coffee || "Kopi gratis"}`, b, "Berlaku hari ini di coffee cart stand");
      return { ok: true, text: "Kopi gratis menunggumu di coffee cart. Sambil ngopi, ngobrol dengan recruiter yuk!", voucher: v };
    }
    if (acc === "balloons") {
      if (claims[ckey] === today) return { ok: false, text: "Balon di stand ini sudah kamu pecahkan hari ini" };
      claims[ckey] = today;
      const coins = 1 + Math.floor(this.rand() * 3);
      this.earn(coins, `Balon di stand ${b.company}`);
      this.ad(key, "click");
      return { ok: true, text: `Pop! Kamu dapat ${coins} koin 🎈`, coins };
    }
    if (acc === "photobooth") {
      this.ad(key, "click");
      if (!claims[ckey]) {
        claims[ckey] = today;
        this.gainXp(5);
      }
      return { ok: true, text: "Foto tersimpan" };
    }
    this.ad(key, "click");
    return { ok: true, text: "" };
  }

  private giveVoucher(title: string, b: CompanyBooth, terms: string) {
    const v: Voucher = { id: this.id("vc"), kind: "merchant", title, code: `${b.logo}-${Math.floor(1000 + this.rand() * 9000)}`, terms, outlet: `Stand ${b.company}`, from: b.company, at: this.now(), used: false };
    this.player.vouchers.unshift(v);
    this.persist();
    this.emit();
    return v;
  }

  /** Put every booth back to the event's data, then apply what each company saved. */
  private loadCompany(saved: Record<string, CompanyState> | undefined) {
    this.company.clear();
    for (const b of this.fair.booths) {
      const base = this.original.get(b.id) ?? this.org.added.find((x) => x.id === b.id);
      if (base) Object.assign(b, structuredClone(base));
      const st = saved?.[b.id];
      if (st) {
        this.company.set(b.id, st);
        Object.assign(b, st.edits);
        if (st.owned.includes("vip")) b.tier = "premium";
      }
      const rec = this.staff.find((x) => x.id === recruiterId(b.id));
      if (rec) rec.name = b.recruiter;
    }
    this.syncCompanyPromoters();
    this.refreshFloors();
  }

  /** What the hall floors were last built from: where booths stand, and which are wide or gated. */
  private floorSig = "";

  /** Rebuild the hall floors' walls when a booth became VIP (wider) or got a gate. */
  private refreshFloors() {
    const sig = this.fair.booths.map((b) => `${b.id}:${b.floor}:${b.x}:${b.y}:${b.tier}:${boothHasGate(b)}`).join() + this.fair.sponsors.map((x) => x.id).join();
    if (sig === this.floorSig) return;
    this.floorSig = sig;
    this.fair.floors.forEach((_, i) => (this.floors[i] = buildJobFairFloor(this.fair, i)));
  }

  /**
   * The organiser sets a booth up directly: VIP or regular, theme, add-ons (given for free) and
   * their content such as the video link and the gate. Stored with the company's own changes.
   */
  configureBooth(boothId: string, cfg: { tier?: "premium" | "regular"; theme?: BoothTheme; accessories?: string[]; media?: Partial<BoothMedia> }) {
    const b = this.booth(boothId);
    if (!b) return;
    const st = this.companyOf(boothId);
    if (cfg.tier) {
      st.edits.tier = cfg.tier;
      b.tier = cfg.tier;
      if (cfg.tier === "regular") st.owned = st.owned.filter((x) => x !== "vip");
    }
    if (cfg.theme) {
      st.edits.theme = cfg.theme;
      b.theme = cfg.theme;
    }
    if (cfg.accessories) {
      const list = ACCESSORY_PRODUCTS.filter((p) => cfg.accessories!.includes(p.id)).map((p) => p.id);
      for (const id of list) if (!st.owned.includes(id) && (productOf(id)?.price ?? 0) > 0) st.owned.push(id);
      st.edits.accessories = list;
      b.accessories = [...list];
    }
    if (cfg.media) {
      const media = { ...b.media, ...structuredClone(cfg.media) };
      st.edits.media = media;
      b.media = media;
    }
    this.refreshFloors();
    this.persist();
    this.emit();
  }

  /** Companies that bought a walking promoter get one on their booth's floor. */
  private syncCompanyPromoters() {
    const list = this.fair.promoters;
    const before = list.filter((p) => p.boothId).map((p) => JSON.stringify(p)).join();
    for (let n = list.length - 1; n >= 0; n--) if (list[n]!.boothId) list.splice(n, 1);
    for (const b of this.fair.booths) {
      if (!this.company.get(b.id)?.owned.includes("promoter")) continue;
      const c = b.promoter ?? {};
      const jobs = openJobs(b);
      list.push({
        id: `co-${b.id}`,
        boothId: b.id,
        name: c.name?.trim() || `Tim ${b.company}`,
        brand: b.company,
        emoji: c.emoji?.trim() || "💼",
        color: b.color,
        level: hallLevel(this.fair, b.floor),
        x: 24,
        y: 13,
        headline: c.headline?.trim() || `${b.company} buka ${jobs.length} lowongan`,
        offer: c.offer?.trim() || `Kami sedang mencari ${jobs.slice(0, 2).map((j) => j.title).join(" dan ") || "talenta baru"}. Mampir ke stand kami di ${hallName(this.fair, b.floor)} ya!`,
        cta: "Lihat lowongan",
        url: b.website ?? "",
        code: c.code?.trim() || undefined,
        callouts: c.callouts?.length ? c.callouts : [`${b.company} lagi buka lowongan! 💼`, "Mampir ke stand kami yuk!"],
        walks: true,
      });
    }
    if (before !== list.filter((p) => p.boothId).map((p) => JSON.stringify(p)).join()) this.rebuildStaff();
  }


  /** Called after a company changes an application's status here; the live app sends it to the server. */
  onStatusChange: ((a: FairApplication) => void) | null = null;
  /** Called after either side adds to an application's conversation (chat, interview, rating, calls). */
  onShared: ((a: FairApplication) => void) | null = null;

  /** Applications the server has: the player's own (from any device), or the ones a booth received. */
  mergeServer(list: FairApplicationOut[], mine: boolean) {
    let changed = false;
    for (const s of list) {
      const have = this.applications.find((x) => x.id === s.id);
      if (have) {
        if (!mine) have.visitorId = `user:${s.seeker}`;
        if (s.updatedAt > (have.serverAt ?? 0)) {
          const before = structuredClone(have);
          have.status = s.status;
          have.updatedAt = Math.max(have.updatedAt ?? 0, s.updatedAt);
          have.serverAt = s.updatedAt;
          this.takeShared(have, s);
          if (mine) this.tellPlayer(before, have);
          else this.tellCompany(before, have);
          changed = true;
        }
        continue;
      }
      this.applications.push({
        id: s.id,
        at: s.at,
        visitorId: mine ? PLAYER_ID : `user:${s.seeker}`,
        name: s.name,
        boothId: s.boothId,
        company: s.company,
        jobId: s.jobId,
        jobTitle: s.jobTitle,
        email: s.email,
        phone: s.phone ?? "",
        cvUrl: s.cvUrl ?? "",
        message: s.message ?? "",
        status: s.status,
        isBot: false,
        psych: s.psych,
        verified: s.verified,
        headline: s.headline,
        education: s.education,
        skills: s.skills,
        city: s.city,
        photo: safeImage(s.photo),
        updatedAt: s.updatedAt,
        serverAt: s.updatedAt,
        messages: s.messages,
        interview: s.interview,
        rating: s.rating,
        feedback: s.feedback,
        calls: s.calls,
      });
      if (!mine) this.notify(s.boothId, "apply", `${s.name} melamar ${s.jobTitle}`, s.id);
      changed = true;
    }
    if (!changed) return;
    this.applications.sort((x, y) => y.at - x.at);
    this.persist();
    this.emit();
  }

  /** The server's copy of the conversation: messages from both sides are kept, the rest is the server's. */
  private takeShared(a: FairApplication, s: FairApplicationOut) {
    const key = (m: AppMessage) => `${m.at}|${m.from}|${m.text}`;
    const seen = new Set((s.messages ?? []).map(key));
    a.messages = [...(s.messages ?? []), ...(a.messages ?? []).filter((m) => !seen.has(key(m)))].sort((x, y) => x.at - y.at);
    if (s.interview) a.interview = s.interview;
    if (s.rating !== undefined) a.rating = s.rating;
    if (s.feedback !== undefined) a.feedback = s.feedback;
    if (s.calls) a.calls = s.calls;
  }

  /** The applicant answered on another device: tell the company in its portal. */
  private tellCompany(before: FairApplication, after: FairApplication) {
    const seen = before.messages?.length ?? 0;
    for (const m of (after.messages ?? []).slice(seen)) if (m.from === "seeker") this.notify(after.boothId, "chat", `${after.name}: ${m.text.slice(0, 120)}`, after.id);
    if (after.interview?.reply && after.interview.reply !== before.interview?.reply)
      this.notify(after.boothId, "confirm", after.interview.reply === "hadir" ? `${after.name} konfirmasi hadir interview ${after.jobTitle}` : `${after.name} minta jadwal ulang interview ${after.jobTitle}`, after.id);
  }

  /** The company changed one of the player's applications in another tab (its portal): say what changed. */
  private tellPlayer(before: FairApplication, after: FairApplication) {
    const seen = before.messages?.length ?? 0;
    for (const m of (after.messages ?? []).slice(seen)) if (m.from === "company") this.notices.push(`💬 ${after.company}: ${m.text.slice(0, 80)}`);
    if (after.interview && JSON.stringify(after.interview) !== JSON.stringify(before.interview) && !this.interviewAlerts.includes(after.id)) this.interviewAlerts.push(after.id);
    else if (after.status !== before.status && after.status !== "Dilihat") this.notices.push(`📋 ${after.company}: lamaran ${after.jobTitle} kamu sekarang "${after.status}"`);
  }

  /** Live: what belongs to the signed-in player, saved to their account so it follows them to any device. */
  progress(): PlayerProgress {
    return {
      player: structuredClone(this.player),
      stamps: [...(this.visitedBy.get(PLAYER_ID) ?? [])],
      inbox: this.inbox.filter((n) => n.to === PLAYER_ID),
    };
  }

  /** Live: take the account's saved progress (from another device), or start fresh with null. */
  loadProgress(p: PlayerProgress | null) {
    // Replace, not merge: nothing from the account that played here before may carry over.
    for (const k of Object.keys(this.player)) delete (this.player as unknown as Record<string, unknown>)[k];
    Object.assign(this.player, freshPlayer(), p?.player ?? {});
    if (p?.stamps?.length) this.visitedBy.set(PLAYER_ID, new Set(p.stamps.filter((id) => typeof id === "string")));
    else this.visitedBy.delete(PLAYER_ID);
    const others = this.inbox.filter((n) => n.to !== PLAYER_ID);
    const mine = (p?.inbox ?? []).filter((n) => n && n.to === PLAYER_ID && typeof n.text === "string");
    this.inbox.splice(0, this.inbox.length, ...others, ...mine);
    this.inbox.sort((x, y) => y.at - x.at);
    trimInbox(this.inbox);
    const me = this.visitors.get(PLAYER_ID);
    if (me) me.verified = !!this.player.verified;
    this.persist();
    this.emit();
  }

  /** Live: the setup every visitor shares, the organiser's changes and each company's booth. */
  sharedState() {
    return { org: this.org, companies: Object.fromEntries(this.company) as Record<string, CompanyState> };
  }

  /** Live: take the setup from the server. Missing parts keep what this browser has. */
  applyShared(org: OrgState | null, companies: Record<string, CompanyState>, bookings: BookedBooth[] = []) {
    const base = org ?? (bookings.length ? this.org : null);
    if (base) {
      const next = structuredClone(base);
      next.added ??= [];
      next.removed ??= [];
      for (const b of bookings) {
        this.booked.add(b.booth.id);
        if (next.removed.includes(b.booth.id)) continue;
        if (!next.added.some((x) => x.id === b.booth.id)) next.added.push(b.booth);
        if (b.pin && !next.pins?.[b.booth.id]) next.pins = { ...next.pins, [b.booth.id]: b.pin };
        if (b.booking && !next.bookings?.some((x) => x.id === b.booking!.id)) next.bookings = [b.booking, ...(next.bookings ?? [])];
      }
      this.loadOrg(next);
    }
    this.loadCompany({ ...Object.fromEntries(this.company), ...companies });
    this.persist();
    this.emit();
  }

  /** Another tab saved: take its company edits and any newer applications. */
  mergeSaved(saved: FairSaved | null) {
    if (!saved) return;
    this.loadOrg(saved.org);
    this.loadCompany(saved.company);
    for (const a of saved.applications ?? []) {
      if (!this.booth(a.boothId)) continue;
      const mine = this.applications.find((x) => x.id === a.id);
      if (!mine) this.applications.push(a);
      else if ((a.updatedAt ?? 0) > (mine.updatedAt ?? 0)) {
        if (a.visitorId === PLAYER_ID) this.tellPlayer(mine, a);
        Object.assign(mine, a);
      }
    }
    this.applications.sort((x, y) => y.at - x.at);
    // Notifications from the other tab, and what it marked read.
    const byId = new Map(this.inbox.map((n) => [n.id, n]));
    for (const n of saved.inbox ?? []) {
      const mine = byId.get(n.id);
      if (mine) mine.read ||= n.read;
      else this.inbox.push(n);
    }
    this.inbox.sort((x, y) => y.at - x.at);
    trimInbox(this.inbox);
    this.emit();
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
      company: Object.fromEntries(this.company),
      org: this.org,
      inbox: this.inbox,
      visitedBy: Object.fromEntries([...this.visitedBy].filter(([id]) => real.has(id)).map(([id, set]) => [id, [...set]])),
    });
  }

  /** Forget everything saved: applications, stamps and counters. */
  reset() {
    this.applications.length = 0;
    this.inbox.length = 0;
    this.loadOrg(undefined);
    this.loadCompany(undefined);
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

  /** The building level of a floor: the level its hall or room sits on. */
  levelOf(floorId: string) {
    return this.roomOf(floorId)?.level ?? hallLevel(this.fair, Math.max(0, fairFloorIndex(floorId)));
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
      else if (room.kind === "aula") this.say(roomStaffId(room.id), `Selamat datang di Aula, ${v.displayName}! Jadwal acara ada di papan kiri.`, 3000);
      else if (room.kind === "konsultasi") this.say(roomStaffId(room.id), `Halo ${v.displayName}! Pilih konsultan di meja belakang, atau duduk di sofa dan telepon teman.`, 3400);
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

  /** Free daily coins, with a bonus for claiming several days in a row. Returns the coins given. */
  claimDaily() {
    if (!this.canClaimDaily()) return 0;
    const yesterday = new Date(this.now() - 86400000).toISOString().slice(0, 10);
    this.player.streak = this.player.dailyOn === yesterday ? (this.player.streak ?? 0) + 1 : 1;
    this.player.dailyOn = this.today();
    const bonus = streakBonus(this.player.streak);
    this.earn(DAILY_COINS + bonus, bonus ? `Koin gratis harian + bonus ${this.player.streak} hari beruntun` : "Koin gratis harian");
    this.emit();
    return DAILY_COINS + bonus;
  }

  // --- Daily missions and sofa mini games.

  /** Today's progress, started fresh on a new day. */
  dailyState(): DailyState {
    const day = this.today();
    if (this.player.daily?.day !== day) this.player.daily = { day, counts: {}, claimed: [], bonus: false, gameCoins: 0 };
    return this.player.daily;
  }

  /** Count something the player did towards today's missions. */
  track(kind: MissionKind, n = 1) {
    const s = this.dailyState();
    s.counts[kind] = (s.counts[kind] ?? 0) + n;
    this.persist();
    this.emit();
  }

  missions() {
    const s = this.dailyState();
    return todaysMissions(s.day).map((m) => ({ ...m, progress: Math.min(s.counts[m.kind] ?? 0, m.target), claimed: s.claimed.includes(m.id) }));
  }

  /** Missions done but not yet claimed, plus the all-done bonus. */
  claimable() {
    const list = this.missions();
    return list.filter((m) => m.progress >= m.target && !m.claimed).length + (list.every((m) => m.claimed) && !this.dailyState().bonus ? 1 : 0);
  }

  claimMission(id: string) {
    const m = this.missions().find((x) => x.id === id);
    if (!m || m.claimed || m.progress < m.target) return false;
    this.dailyState().claimed.push(m.id);
    this.earn(m.coins, `Misi: ${m.title}`);
    this.gainXp(m.xp);
    return true;
  }

  claimMissionBonus() {
    const s = this.dailyState();
    if (s.bonus || !this.missions().every((m) => m.claimed)) return false;
    s.bonus = true;
    this.earn(MISSIONS_BONUS, "Bonus semua misi harian");
    this.emit();
    return true;
  }

  /** Pay a mini game's reward, up to what is left of today's cap. Returns the coins given. */
  rewardGame(game: string, coins: number) {
    const s = this.dailyState();
    const give = Math.max(0, Math.min(Math.floor(coins), GAME_DAILY_CAP - s.gameCoins));
    s.gameCoins += give;
    if (give) this.earn(give, `Mini game: ${game}`);
    this.track("game");
    return give;
  }

  /** Finished reading a career article: XP the first time, and it counts towards today's missions. */
  readArticle(id: string) {
    const read = (this.player.read ??= []);
    const first = !read.includes(id);
    if (first) {
      read.push(id);
      this.gainXp(XP.read);
    }
    this.track("read");
    return first;
  }

  /** Tick or untick a step on a profession's roadmap. Finishing a whole stage gives XP once. */
  toggleStep(articleId: string, key: string) {
    const map = (this.player.roadmap ??= {});
    const done = (map[articleId] ??= []);
    const i = done.indexOf(key);
    if (i >= 0) done.splice(i, 1);
    else {
      done.push(key);
      const stage = key.split(".")[0]!;
      const a = CAREER_ARTICLES.find((x) => x.id === articleId);
      const total = a?.roadmap[Number(stage)]?.steps.length ?? 0;
      const stageKey = `stage:${stage}`;
      if (total && done.filter((k) => k.startsWith(`${stage}.`)).length === total && !done.includes(stageKey)) {
        done.push(stageKey);
        this.gainXp(XP.roadmapStage);
        this.notices.push(`Tahap ${a!.roadmap[Number(stage)]!.level} roadmap ${a!.role} selesai, +${XP.roadmapStage} XP`);
      }
    }
    this.persist();
    this.emit();
  }

  gameCoinsLeft() {
    return GAME_DAILY_CAP - this.dailyState().gameCoins;
  }

  private today() {
    return new Date(this.now()).toISOString().slice(0, 10);
  }

  /** Whether the player may enter: a room id, or a booth floor's id. */
  hasTicket(id: string) {
    const room = this.room(id);
    return (room ? room.price === 0 : this.floorPrice(id) === 0) || this.player.tickets.includes(id);
  }

  /** The pass for a room id or a booth floor id. */
  private passById(id: string) {
    const room = this.room(id);
    return this.passFor(room ? fairRoomFloorId(this.fair, room.id) : id);
  }

  /** What entering a room costs right now, and which voucher would be used. */
  roomPrice(roomId: string) {
    const room = this.passById(roomId);
    if (!room) return { price: 0, voucher: null as Voucher | null };
    const free = this.player.vouchers.find((v) => !v.used && v.kind === "room-free" && v.room === roomId);
    const half = this.player.vouchers.find((v) => !v.used && v.kind === "room-half" && v.room === roomId);
    if (free) return { price: 0, voucher: free };
    if (half) return { price: Math.ceil(room.price / 2), voucher: half };
    return { price: room.price, voucher: null };
  }

  /** Buy a ticket for a premium room. False when there are not enough coins. */
  buyTicket(roomId: string) {
    const room = this.passById(roomId);
    if (!room) return this.hasTicket(roomId);
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
    this.track("promo");
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
    this.track("promo");
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

  /** Start a paid call in the consultation lounge: with a consultant, or with another job seeker.
   *  The price buys one call of up to `minutes`; the call screen hangs up when the time is over. */
  startLoungeCall(kind: "consult" | "peer", minutes: number, who: string) {
    const plan = LOUNGE_PLANS.find((p) => p.minutes === minutes);
    if (!plan) return false;
    const cost = kind === "consult" ? plan.consultCoins : plan.coins;
    if (!this.spend(cost, `${kind === "consult" ? "Konsultasi" : "Telepon"} ${minutes} menit dengan ${who}`)) return false;
    this.gainXp(kind === "consult" ? 15 : 5);
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
    this.track("psych");
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
    this.onShared?.(a);
    this.persist();
    this.emit();
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
    // Everyone comes in on the lowest floor: the Aula when it is below the halls, else the first hall.
    const floorId = this.stops[0]?.floorId ?? this.floors[0]!.id;
    const v: FairVisitor = { memberId: id, visitId: id, displayName: name, memberType: "host", floorId, x, y, facing: "back", isBot, arrivedAt: this.now() };
    if (id === PLAYER_ID) v.verified = !!this.player.verified;
    // A few bots are verified too, so the badge is something people recognise.
    else if (isBot && this.rand() < 0.25) v.verified = true;
    this.visitors.set(id, v);
    this.log({ type: "arrive", name });
    if (!isBot) {
      const host = this.roomOf(floorId);
      const where = this.fair.floors.length ? `${hallName(this.fair, 0)} sampai ${hallName(this.fair, this.fair.floors.length - 1)}` : "";
      this.say(host ? roomStaffId(host.id) : "fair-info", `Selamat datang, ${name}! Ada ${this.fair.booths.length} perusahaan di ${where}. Naik lift di kanan bawah.`, 3600);
    }
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
    if (visitorId === PLAYER_ID) this.track("visit");
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

  apply(
    visitorId: string,
    input: { id?: string; boothId: string; jobId: string; name?: string; email?: string; phone?: string; cvUrl?: string; message?: string; headline?: string; education?: string; skills?: string; city?: string; photo?: string },
  ) {
    const v = this.visitors.get(visitorId);
    const b = this.booth(input.boothId);
    const job = b?.jobs.find((j) => j.id === input.jobId);
    if (!v || !b || !job || job.closed) return null;
    if (this.applications.some((a) => a.visitorId === visitorId && a.jobId === job.id)) return null;
    if (!v.isBot) {
      // Real seekers pay for each application: a free-apply voucher first, otherwise coins.
      const voucher = this.player.vouchers.find((x) => !x.used && x.kind === "free-apply");
      if (voucher) voucher.used = true;
      else if (!this.spend(APPLY_COST, `Lamar ${job.title} di ${b.company}`)) return null;
    }
    const a: FairApplication = {
      id: input.id ?? this.id("app"),
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
      headline: input.headline,
      education: input.education,
      skills: input.skills,
      city: input.city,
      photo: v.isBot ? undefined : safeImage(input.photo),
      updatedAt: this.now(),
    };
    this.applications.unshift(a);
    this.notify(b.id, "apply", `${a.name} melamar ${job.title}`, a.id);
    if (visitorId === PLAYER_ID) this.track("apply");
    this.log({ type: "apply", name: a.name, company: b.company, jobTitle: job.title });
    this.persist();
    this.say(recruiterId(b.id), `Terima kasih, ${a.name}! Lamaran ${job.title} kami terima.`, 3200);
    if (!v.isBot) this.gainXp(XP.apply);
    if (this.simulated) this.simulateRecruiter(a);
    this.emit();
    return a;
  }

  /** Demo companies read and rate an application by themselves a little later. */
  private simulateRecruiter(a: FairApplication) {
    this.after(6000, () => {
      if (a.status === "Terkirim") {
        a.status = "Dilihat";
        a.updatedAt = this.now();
      }
      this.persist();
      this.emit();
    });
    // The company reads the application and rates the applicant a little later.
    this.after(12000 + this.rand() * 6000, () => {
      if (a.rating) return;
      const stars = this.autoRating(a);
      this.rateApplicant(a.id, stars, FEEDBACK[stars - 1]);
      // Bot companies decide by themselves; a company that has opened its portal decides by hand.
      if (!this.company.has(a.boothId) && (a.status === "Dilihat" || a.status === "Terkirim")) a.status = stars >= 4 ? "Diundang interview" : stars <= 2 ? "Belum cocok" : "Dilihat";
      a.updatedAt = this.now();
      if (a.visitorId === PLAYER_ID) {
        this.notices.push(`${a.company} memberi kamu ${"★".repeat(stars)} untuk lamaran ${a.jobTitle}`);
        this.notify(PLAYER_ID, "rating", `${a.company} memberi ${"★".repeat(stars)} untuk lamaran ${a.jobTitle}`, a.id);
      }
      this.persist();
      this.emit();
    });
  }

  /** The recruiter's decision, from the admin view. */
  setStatus(applicationId: string, status: ApplicationStatus, quiet = false) {
    const a = this.applications.find((x) => x.id === applicationId);
    if (!a || a.status === status) return;
    a.status = status;
    a.updatedAt = this.now();
    this.onStatusChange?.(a);
    if (a.visitorId === PLAYER_ID && status !== "Dilihat" && !quiet) {
      this.notices.push(`📋 ${a.company}: lamaran ${a.jobTitle} kamu sekarang "${status}"`);
      this.notify(PLAYER_ID, "status", `${a.company}: lamaran ${a.jobTitle} sekarang "${status}"`, a.id);
    }
    this.persist();
    this.emit();
  }

  // ---- Company portal -------------------------------------------------------------------

  private companyOf(boothId: string) {
    let st = this.company.get(boothId);
    if (!st) {
      st = { edits: {}, owned: [], invoices: [] };
      this.company.set(boothId, st);
    }
    return st;
  }

  /** The company changes its booth: profile, theme, FAQ, vacancies, decorations. */
  editBooth(boothId: string, patch: BoothEdit) {
    const b = this.booth(boothId);
    if (!b) return;
    const clean: BoothEdit = {};
    for (const k of EDITABLE) if (k in patch) (clean as Record<string, unknown>)[k] = structuredClone(patch[k]);
    if (clean.company !== undefined && !clean.company.trim()) delete clean.company;
    if (clean.logo !== undefined) clean.logo = clean.logo.trim().slice(0, 3) || b.logo;
    if ("logoImg" in clean) clean.logoImg = safeImage(clean.logoImg);
    Object.assign(b, clean);
    Object.assign(this.companyOf(boothId).edits, clean);
    if ("promoter" in clean || "color" in clean || "company" in clean || "jobs" in clean) this.syncCompanyPromoters();
    if ("accessories" in clean) this.refreshFloors();
    const rec = this.staff.find((x) => x.id === recruiterId(boothId));
    if (rec) rec.name = b.recruiter;
    this.persist();
    this.emit();
  }

  /** Add a vacancy or replace the one with the same id. */
  saveJob(boothId: string, job: JobPosting) {
    const b = this.booth(boothId);
    if (!b || !job.title.trim()) return;
    const jobs = b.jobs.some((j) => j.id === job.id) ? b.jobs.map((j) => (j.id === job.id ? job : j)) : [...b.jobs, job];
    this.editBooth(boothId, { jobs });
  }

  /** Remove a vacancy. One that already has applicants is closed instead, so they keep their history. */
  deleteJob(boothId: string, jobId: string): "deleted" | "closed" | null {
    const b = this.booth(boothId);
    const job = b?.jobs.find((j) => j.id === jobId);
    if (!b || !job) return null;
    if (this.applications.some((a) => a.jobId === jobId && a.boothId === boothId)) {
      this.saveJob(boothId, { ...job, closed: true });
      return "closed";
    }
    this.editBooth(boothId, { jobs: b.jobs.filter((j) => j.id !== jobId) });
    return "deleted";
  }

  newJobId(boothId: string) {
    return `${boothId}-job-${this.now().toString(36)}${Math.floor(this.rand() * 1000)}`;
  }

  /** Free products, and those the company paid for. */
  owns(boothId: string, productId: string) {
    const p = productOf(productId);
    if (!p) return false;
    if (productId === "vip") return this.booth(boothId)?.tier === "premium";
    if (VIP_INCLUDED.includes(productId) && this.booth(boothId)?.tier === "premium") return true;
    return p.price === 0 || !!this.company.get(boothId)?.owned.includes(productId);
  }

  /** Switch a decoration on or off. Floor decorations are limited to the booth's free spots. */
  toggleAccessory(boothId: string, id: string): boolean {
    const b = this.booth(boothId);
    const prod = ACCESSORY_PRODUCTS.find((p) => p.id === id);
    if (!b || !prod || !this.owns(boothId, id)) return false;
    const on = new Set(b.accessories ?? []);
    if (on.has(id)) on.delete(id);
    else {
      const floorUsed = ACCESSORY_PRODUCTS.filter((p) => p.slot === "floor" && on.has(p.id)).length;
      if (prod.slot === "floor" && floorUsed >= FLOOR_SLOTS) return false;
      on.add(id);
    }
    this.editBooth(boothId, { accessories: ACCESSORY_PRODUCTS.filter((p) => on.has(p.id)).map((p) => p.id) });
    return true;
  }

  /** A bill for products the company does not have yet. */
  createInvoice(boothId: string, productIds: string[]) {
    const items = [...new Set(productIds)]
      .map((id) => productOf(id))
      .filter((p): p is NonNullable<typeof p> => !!p && p.price > 0 && !this.owns(boothId, p.id))
      .map((p) => ({ id: p.id, name: p.name, price: p.price }));
    if (!items.length || !this.booth(boothId)) return null;
    const st = this.companyOf(boothId);
    const d = new Date(this.now());
    const inv: CompanyInvoice = {
      id: this.id("inv"),
      no: `INV/${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}/${boothId.toUpperCase().slice(0, 4)}/${String(st.invoices.length + 1).padStart(3, "0")}`,
      at: this.now(),
      items,
      total: items.reduce((n, i) => n + i.price, 0),
      status: "Belum dibayar",
    };
    st.invoices.unshift(inv);
    this.persist();
    this.emit();
    return inv;
  }

  /** Demo payment: marks the bill paid and switches on what it bought. */
  payInvoice(boothId: string, invoiceId: string, method: string) {
    const st = this.company.get(boothId);
    const inv = st?.invoices.find((i) => i.id === invoiceId);
    const b = this.booth(boothId);
    if (!st || !inv || !b || inv.status !== "Belum dibayar") return false;
    inv.status = "Lunas";
    inv.method = method;
    inv.paidAt = this.now();
    for (const it of inv.items) if (!st.owned.includes(it.id)) st.owned.push(it.id);
    if (inv.items.some((i) => i.id === "vip")) b.tier = "premium";
    for (const it of inv.items) if (it.id !== "vip" && it.id !== "promoter" && !(b.accessories ?? []).includes(it.id)) this.toggleAccessory(boothId, it.id);
    this.syncCompanyPromoters();
    this.refreshFloors();
    this.persist();
    this.emit();
    return true;
  }

  cancelInvoice(boothId: string, invoiceId: string) {
    const inv = this.company.get(boothId)?.invoices.find((i) => i.id === invoiceId);
    if (!inv || inv.status !== "Belum dibayar") return;
    inv.status = "Dibatalkan";
    this.persist();
    this.emit();
  }

  private touch(a: FairApplication) {
    a.updatedAt = this.now();
    this.onShared?.(a);
    this.persist();
    this.emit();
  }

  /** The company's private note on an applicant. */
  noteApplicant(applicationId: string, notes: string) {
    const a = this.applications.find((x) => x.id === applicationId);
    if (!a) return;
    a.notes = notes.slice(0, 1000);
    this.touch(a);
  }

  /** Invite an applicant to an interview, and tell them in the chat. */
  scheduleInterview(applicationId: string, iv: Interview) {
    const a = this.applications.find((x) => x.id === applicationId);
    if (!a) return;
    const moved = !!a.interview;
    a.interview = { ...iv, reply: undefined };
    if (a.visitorId === PLAYER_ID && !this.interviewAlerts.includes(a.id)) this.interviewAlerts.push(a.id);
    this.setStatus(a.id, "Diundang interview", true);
    const when = new Date(iv.at).toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    if (a.visitorId === PLAYER_ID) this.notify(PLAYER_ID, "interview", `${a.company} ${moved ? "mengubah jadwal" : "mengundang"} interview ${a.jobTitle}: ${when}`, a.id);
    this.messageApplicant(a.id, `Halo ${a.name}, kami mengundang kamu interview ${a.jobTitle} via ${iv.mode} pada ${when}${iv.place ? ` (${iv.place})` : ""}.${iv.note ? ` ${iv.note}` : ""}`, true);
    // Bots answer the invitation by themselves.
    if (a.isBot) this.after(4000 + this.rand() * 4000, () => this.answerInterview(a.id, this.rand() < 0.85 ? "hadir" : "jadwal-ulang"));
  }

  /** A chat message from the company. Bots answer a moment later. */
  messageApplicant(applicationId: string, text: string, quiet = false) {
    const a = this.applications.find((x) => x.id === applicationId);
    if (!a || !text.trim()) return;
    (a.messages ??= []).push({ at: this.now(), from: "company", text: text.trim().slice(0, 600) });
    if (a.visitorId === PLAYER_ID) {
      this.notices.push(`💬 ${a.company}: ${text.trim().slice(0, 80)}`);
      if (!quiet) this.notify(PLAYER_ID, "chat", `${a.company}: ${text.trim().slice(0, 120)}`, a.id);
    }
    if (a.isBot && !quiet)
      this.after(2500 + this.rand() * 2500, () => {
        const reply = this.pick(BOT_REPLIES);
        (a.messages ??= []).push({ at: this.now(), from: "seeker", text: reply });
        this.notify(a.boothId, "chat", `${a.name}: ${reply}`, a.id);
        this.touch(a);
      });
    this.touch(a);
  }

  /** The job seeker answers the company's chat. */
  replyToCompany(applicationId: string, text: string) {
    const a = this.applications.find((x) => x.id === applicationId);
    if (!a || !text.trim()) return;
    (a.messages ??= []).push({ at: this.now(), from: "seeker", text: text.trim().slice(0, 600) });
    this.notify(a.boothId, "chat", `${a.name} membalas: ${text.trim().slice(0, 120)}`, a.id);
    this.touch(a);
  }

  /** The applicant answers an interview invitation: coming, or asking for another time. */
  answerInterview(applicationId: string, reply: "hadir" | "jadwal-ulang", note = "") {
    const a = this.applications.find((x) => x.id === applicationId);
    if (!a?.interview || a.interview.reply === reply) return;
    a.interview.reply = reply;
    const text = reply === "hadir" ? "Terima kasih, saya konfirmasi hadir di interview." : `Mohon maaf, bisakah jadwal interview diganti?${note.trim() ? ` ${note.trim()}` : ""}`;
    (a.messages ??= []).push({ at: this.now(), from: "seeker", text });
    this.notify(a.boothId, "confirm", reply === "hadir" ? `${a.name} konfirmasi hadir interview ${a.jobTitle}` : `${a.name} minta jadwal ulang interview ${a.jobTitle}`, a.id);
    this.touch(a);
  }

  logCall(applicationId: string, log: CallLog) {
    const a = this.applications.find((x) => x.id === applicationId);
    if (!a) return;
    (a.calls ??= []).unshift(log);
    if (!log.answered && a.visitorId === PLAYER_ID) {
      this.notices.push(`📞 Panggilan tak terjawab dari ${a.company}`);
      this.notify(PLAYER_ID, "call", `Panggilan ${log.kind === "video" ? "video" : "telepon"} tak terjawab dari ${a.company}`, a.id);
    }
    if (!log.answered) this.notify(a.boothId, "call", `${a.name} tidak mengangkat panggilan ${log.kind === "video" ? "video" : "telepon"}`, a.id);
    this.touch(a);
  }

  // ---- Notifications between applicants and HR ------------------------------------------

  /** Notifications for the job seeker (PLAYER_ID) or one company (its booth id), newest first. */
  readonly inbox: FairNotif[] = [];

  private notify(to: string, kind: FairNotif["kind"], text: string, appId?: string) {
    // Another tab numbers its notifications too: add the time and a random tail so ids never clash.
    const id = `ntf-${this.now().toString(36)}-${++this.seq}-${Math.random().toString(36).slice(2, 6)}`;
    this.inbox.unshift({ id, at: this.now(), to, kind, text, appId });
    trimInbox(this.inbox);
    this.persist();
  }

  notifsFor(to: string) {
    return this.inbox.filter((n) => n.to === to);
  }

  unreadFor(to: string) {
    return this.inbox.reduce((k, n) => k + (n.to === to && !n.read ? 1 : 0), 0);
  }

  /** Mark one notification, or all of them for someone, as read. */
  markRead(to: string, id?: string) {
    let changed = false;
    for (const n of this.inbox)
      if (n.to === to && !n.read && (!id || n.id === id)) {
        n.read = true;
        changed = true;
      }
    if (!changed) return;
    this.persist();
    this.emit();
  }

  /** Messages for the player that the UI shows as toasts, oldest first. */
  readonly notices: string[] = [];
  /** The player's applications with a new or moved interview, to show as an invitation card. */
  readonly interviewAlerts: string[] = [];

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
      if (this.bots.length < this.maxBots) {
        this.spawnBot();
        changed = true;
      }
    }

    if (now >= this.nextCalloutAt) {
      this.nextCalloutAt = now + 7000 + this.rand() * 9000;
      const quiet = this.fair.booths.filter((b) => this.peopleAt(b.id) === 0 && !this.bubbles.has(recruiterId(b.id)));
      if (quiet.length) {
        const b = this.pick(quiet);
        const open = openJobs(b);
        const own = (b.callouts ?? []).filter((c) => c.trim());
        if (own.length && (this.rand() < 0.6 || !open.length)) this.say(recruiterId(b.id), this.pick(own), 3200);
        else if (open.length) this.say(recruiterId(b.id), this.pick(CALLOUTS)(this.pick(open).title), 3200);
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
    if (now >= this.nextChatAt) {
      this.nextChatAt = now + 1800 + this.rand() * 2400;
      if (this.startChat()) changed = true;
    }

    const step = (WALK_SPEED * Math.min(dtMs, 250)) / 1000;
    for (const bot of [...this.bots]) if (this.tickBot(bot, now, step)) changed = true;
    if (this.tickWalkers(now, step * 0.85)) changed = true;
    if (changed) this.emit();
  }

  private nextRoomAt = 0;
  private nextChatAt = 0;
  /** Until when each floor's current conversation runs, so one floor never has two at once. */
  private chatUntil = new Map<string, number>();

  /**
   * Two job seekers near each other start a short conversation: one asks, the other answers, in turns.
   * One floor at a time, picked at random among the floors where people are close enough to talk.
   */
  private startChat() {
    const now = this.now();
    const free = (v: FairVisitor) => v.isBot && !v.remote && !this.bubbles.has(v.memberId);
    const byFloor = new Map<string, FairVisitor[]>();
    for (const v of this.visitors.values()) if (free(v)) byFloor.set(v.floorId, [...(byFloor.get(v.floorId) ?? []), v]);
    const floors = [...byFloor].filter(([id, list]) => list.length >= 2 && (this.chatUntil.get(id) ?? 0) <= now);
    if (!floors.length) return false;
    const [floorId, list] = this.pick(floors);
    const a = this.pick(list);
    const near = list.filter((b) => b !== a && Math.hypot(b.x - a.x, b.y - a.y) < 4.5);
    if (!near.length) return false;
    const b = this.pick(near);
    const room = this.roomOf(floorId);
    const lines = this.pick(CONVOS[room?.kind ?? "hall"]);
    // Face each other when standing; seated people keep facing their table or the stage.
    if (!a.seatId) a.facing = facingFor(b.x - a.x, b.y - a.y, a.facing);
    if (!b.seatId) b.facing = facingFor(a.x - b.x, a.y - b.y, b.facing);
    const gap = 2400;
    lines.forEach((line, i) =>
      this.after(i * gap, () => {
        const who = i % 2 ? b : a;
        if (this.visitors.get(who.memberId) === who && who.floorId === floorId) this.say(who.memberId, line, gap - 200);
      }),
    );
    this.chatUntil.set(floorId, now + lines.length * gap + 1500);
    return true;
  }
  private speakerLine = 0;

  /** Rooms fill and empty on their own: people sit down, eat, take tests, and leave. */
  private tickRooms() {
    for (const room of this.fair.rooms) {
      const floor = this.floor(fairRoomFloorId(this.fair, room.id));
      const inRoom = [...this.visitors.values()].filter((v) => v.floorId === floor.id && v.isBot);
      const target = Math.round(floor.seats.length * (room.kind === "seminar" ? 0.5 : room.kind === "psikotes" ? 0.4 : 0.35));
      if (this.simulated && inRoom.length < target && this.rand() < 0.7) {
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
        const list = this.seminars();
        const session = list[Math.floor(this.now() / 180000) % list.length]!;
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
      const booth = this.booth(stop.boothId);
      if (!booth) {
        // The organiser took this booth out.
        bot.plan.shift();
        bot.target = null;
        bot.path = null;
        return true;
      }
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
      const open = openJobs(booth);
      const job = open.length ? this.pick(open) : null;
      if (stop.spot === "talk" && job) {
        bot.phase = "talking";
        // In the live app the bot only walks and chats: applications and reviews come from real people.
        const applies = this.simulated && this.rand() < 0.4;
        bot.until = now + (applies ? 7600 : 4600) + this.rand() * 1500;
        const rid = recruiterId(booth.id);
        if (this.simulated && this.rand() < 0.3) this.after(3000, () => this.visitors.has(v.memberId) && this.reviewCompany(v.memberId, booth.id, 3 + Math.round(this.rand() * 2)));
        this.say(v.memberId, this.pick(QUESTIONS)(booth, job.title), 2200);
        this.after(1700, () => this.visitors.has(v.memberId) && this.say(rid, this.pick(ANSWERS)(booth, job.title), 2600));
        if (applies) {
          this.after(4300, () => this.visitors.has(v.memberId) && this.say(v.memberId, `Saya mau melamar ${job.title}!`, 2200));
          const skills = job.requirements
            .flatMap((r) => r.split(/[,/]| dan /))
            .map((w) => w.trim())
            .filter((w) => w && this.rand() < 0.55)
            .slice(0, 4)
            .join(", ");
          this.after(
            5600,
            () =>
              this.visitors.has(v.memberId) &&
              this.apply(v.memberId, {
                boothId: booth.id,
                jobId: job.id,
                email: `${v.displayName.toLowerCase()}@contoh.id`,
                phone: this.rand() < 0.7 ? `08${Math.floor(1e9 + this.rand() * 9e9)}` : "",
                cvUrl: this.rand() < 0.6 ? `https://cv.example/${v.displayName.toLowerCase()}` : "",
                skills,
                headline: this.pick(["Fresh graduate", "Mahasiswa tingkat akhir", "Pengalaman 2 tahun", "Career switcher"]),
                message: this.rand() < 0.5 ? `Saya tertarik dengan posisi ${job.title} dan sudah belajar ${skills || "banyak hal"}.` : "",
              }),
          );
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

  /** Walking promoters wander the floor, go up to visitors (the player first) and pitch their offer. */
  private tickWalkers(now: number, step: number) {
    let moved = false;
    for (const p of this.fair.promoters) {
      if (!p.walks) continue;
      const s = this.staff.find((x) => x.id === promoterId(p.id));
      if (!s) continue;
      let w = this.walkers.get(p.id);
      if (!w) this.walkers.set(p.id, (w = { path: null, target: null, until: 0, met: new Map(), pitching: null }));
      if (now < w.until) continue;
      if (!w.target) {
        const fresh = [...this.visitors.values()].filter(
          (v) => v.floorId === s.floorId && !v.seatId && now - (w!.met.get(v.memberId) ?? -1e12) > (v.memberId === PLAYER_ID ? 75000 : 40000),
        );
        const who = fresh.find((v) => v.memberId === PLAYER_ID) ?? (fresh.length && this.rand() < 0.5 ? this.pick(fresh) : undefined);
        if (who) {
          w.pitching = who.memberId;
          w.target = { floorId: s.floorId, x: who.x + (who.x > s.x ? -0.9 : 0.9), y: who.y + 0.1 };
        } else {
          w.pitching = null;
          const floor = this.floor(s.floorId);
          for (let i = 0; i < 12 && !w.target; i++) {
            const x = 2 + this.rand() * (floor.width - 4);
            const y = 5 + this.rand() * (floor.height - 7);
            if (!isBlocked(floor, x, y)) w.target = { floorId: s.floorId, x, y };
          }
          if (!w.target) {
            w.until = now + 2000;
            continue;
          }
        }
        w.path = null;
      }
      moved = true;
      if (this.walk(s as unknown as FairVisitor, w, w.target, step)) {
        // Chasing someone who walked off: aim again.
        const v = w.pitching ? this.visitors.get(w.pitching) : undefined;
        if (w.pitching && (!v || v.floorId !== s.floorId || Math.hypot(v.x - w.target.x, v.y - w.target.y) > 2)) w.target = null;
        continue;
      }
      w.target = null;
      const v = w.pitching ? this.visitors.get(w.pitching) : undefined;
      w.pitching = null;
      if (v && Math.hypot(v.x - s.x, v.y - s.y) < 2.4) {
        s.facing = facingFor(v.x - s.x, v.y - s.y, s.facing);
        w.met.set(v.memberId, now);
        w.until = now + 6500;
        this.ad(`promo:${p.id}`, "view");
        if (v.memberId === PLAYER_ID) this.say(s.id, `Halo ${v.displayName}! ${p.headline} 🎁 Tap aku ya!`, 6000);
        else {
          this.say(s.id, `Halo kak! ${p.headline}`, 3000);
          this.after(2000, () => this.visitors.has(v.memberId) && this.say(v.memberId, this.pick(["Wah boleh juga!", "Simpan kodenya ah", "Nanti aku cek ya", "Makasih kak!"]), 2000));
        }
      } else w.until = now + 1200 + this.rand() * 2500;
    }
    return moved;
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
export const consultantId = (id: string) => `consult-${id}`;
export const promoterId = (id: string) => `npc-${id}`;

const FEEDBACK = [
  "Belum sesuai kebutuhan kami saat ini.",
  "Profilmu menarik, tapi pengalamannya belum cukup untuk posisi ini.",
  "Lumayan! Lengkapi CV dan portofolio supaya lebih kuat.",
  "Bagus, kami ingin ngobrol lebih lanjut.",
  "Kandidat yang sangat kuat, kami tunggu di interview!",
];

function freshPlayer(): PlayerState {
  return { coins: START_COINS, txns: [{ at: 0, amount: START_COINS, reason: "Koin sambutan" }], vouchers: [], tickets: [], xp: 0, psych: [], seminars: [], dailyOn: null, meals: 0, verified: false, streak: 0, daily: undefined, read: [], roadmap: {} };
}

/** Reviews a company had before today, made up from its id so every visitor sees the same. */
export function seededReviews(boothId: string) {
  let h = 2166136261;
  for (const ch of boothId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const count = 6 + (h % 29);
  const average = 3.5 + ((h >>> 8) % 14) / 10;
  return { count, sum: Math.round(count * average) };
}

