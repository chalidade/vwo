// Random anomalies: a cat, a puppy, fireflies, a lost balloon, a rubber duck in the food court, a
// little ghost at night... that turns up on a random floor for a short while. Tapping one gives a few
// coins or a "voucher lamar" (the coins for one application); the two rare ones (a golden cat and a
// little dragon) give more. The server decides when and where each one appears (from the clock and a
// secret, so every visitor sees the same one), which kind it is and what it pays; the game only draws it.

/** New kinds go at the end: the order is the order of the organiser's list and the collection. */
export const ANOMALY_KINDS = [
  "cat",
  "dog",
  "fireflies",
  "balloon",
  "pigeon",
  "rooster",
  "turtle",
  "butterfly",
  "robot",
  "ghost",
  "ufo",
  "blackcat",
  "duck",
  "mascot",
  "goldcat",
  "dragon",
] as const;
export type AnomalyKind = (typeof ANOMALY_KINDS)[number];

/** Where a kind may turn up: anywhere, or only in one room. */
export type AnomalyPlace = "foodcourt" | "aula";

export interface AnomalyInfo {
  name: string;
  /** Rare ones come seldom, sparkle, and pay more. */
  rare?: boolean;
  /** How often it comes, against the others out at that hour. */
  weight: number;
  /** Only between these hours, Jakarta time (WIB); `from` > `to` runs past midnight. */
  hours?: readonly [from: number, to: number];
  /** Only in this room (on its floor). */
  place?: AnomalyPlace;
  /** What the toast says after catching it. */
  line: string;
}

export const ANOMALY_INFO: Record<AnomalyKind, AnomalyInfo> = {
  cat: { name: "Kucing oren", weight: 10, line: "Meong! Dia minta dielus dulu." },
  dog: { name: "Anak anjing", weight: 10, line: "Guk! Ekornya nggak berhenti goyang." },
  fireflies: { name: "Kunang-kunang", weight: 10, line: "Cahayanya bikin semangat lagi." },
  balloon: { name: "Balon nyasar", weight: 10, line: "Untung belum terbang ke atap." },
  pigeon: { name: "Burung merpati", weight: 10, line: "Dia bawa surat: semangat cari kerja!" },
  rooster: { name: "Ayam jago", weight: 10, hours: [5, 10], line: "Kukuruyuk! Yang bangun pagi dapat rezeki." },
  turtle: { name: "Kura-kura", weight: 8, line: "Pelan-pelan asal sampai, kayak proses rekrutmen." },
  butterfly: { name: "Kupu-kupu", weight: 10, hours: [6, 18], line: "Cantik, kayak CV yang baru dirapikan." },
  robot: { name: "Robot kecil", weight: 8, line: "Bip-bup! CV kamu lolos sistem." },
  ghost: { name: "Hantu lucu", weight: 10, hours: [18, 5], line: "Boo! Tenang, dia cuma mau kenalan." },
  ufo: { name: "UFO mini", weight: 6, hours: [19, 4], line: "Alien juga lagi cari kerja di bumi." },
  blackcat: { name: "Kucing hitam", weight: 8, hours: [17, 2], line: "Katanya bawa sial? Buktinya kamu dapat hadiah." },
  duck: { name: "Bebek karet", weight: 12, place: "foodcourt", line: "Kwek! Nyasar dari wastafel food court." },
  mascot: { name: "Si Jobi", weight: 12, place: "aula", line: "Maskot jobfair kasih tos. Semangat!" },
  goldcat: { name: "Kucing emas", rare: true, weight: 1, line: "Langka banget! Kucing pembawa hoki ini jarang muncul." },
  dragon: { name: "Naga kecil", rare: true, weight: 1, line: "Legenda itu nyata! Naga kecil memberimu harta." },
};

export const ANOMALY_NAMES = Object.fromEntries(ANOMALY_KINDS.map((k) => [k, ANOMALY_INFO[k].name])) as Record<AnomalyKind, string>;

export const isAnomalyKind = (k: unknown): k is AnomalyKind => typeof k === "string" && (ANOMALY_KINDS as readonly string[]).includes(k);

/** The hour in Jakarta (WIB, UTC+7) at a moment. */
export const wibHour = (at: number) => new Date(at + 7 * 3_600_000).getUTCHours();

/** Whether a kind may come out at this moment. */
export function anomalyOutAt(kind: AnomalyKind, at: number) {
  const h = ANOMALY_INFO[kind].hours;
  if (!h) return true;
  const now = wibHour(at);
  return h[0] <= h[1] ? now >= h[0] && now < h[1] : now >= h[0] || now < h[1];
}

/** The kind of an anomaly starting at `at`, from a roll in [0, 1): weighted among the kinds out then. */
export function pickAnomalyKind(roll: number, at: number): AnomalyKind {
  const open = ANOMALY_KINDS.filter((k) => anomalyOutAt(k, at));
  const total = open.reduce((n, k) => n + ANOMALY_INFO[k].weight, 0);
  let left = Math.min(Math.max(roll, 0), 0.999999) * total;
  for (const k of open) {
    left -= ANOMALY_INFO[k].weight;
    if (left < 0) return k;
  }
  return open[open.length - 1]!;
}

/** One anomaly per slot of this length, at a random moment inside it. */
export const ANOMALY_SLOT_MS = 6 * 60_000;
/** How long one stays on its floor before it wanders off. */
export const ANOMALY_LIVE_MS = 150_000;
/** A tap just before it left still counts once the request arrives. */
export const ANOMALY_GRACE_MS = 10_000;

/** Claims per account per day, unless the organiser sets another number. */
export const ANOMALY_CAP_DEFAULT = 3;
export const ANOMALY_CAP_MAX = 10;

/** The organiser's switch, kept in the "org" setup document as `anomalies`. */
export interface AnomalySettings {
  on: boolean;
  /** Claims per account per day. */
  cap: number;
}

/** The organiser's settings from the "org" document, with defaults: on, three a day. */
export function anomalySettings(org: unknown): AnomalySettings {
  const raw = org && typeof org === "object" ? (org as { anomalies?: unknown }).anomalies : undefined;
  const a = raw && typeof raw === "object" ? (raw as { on?: unknown; cap?: unknown }) : {};
  const cap = typeof a.cap === "number" && Number.isFinite(a.cap) ? Math.round(a.cap) : ANOMALY_CAP_DEFAULT;
  return { on: a.on !== false, cap: Math.min(ANOMALY_CAP_MAX, Math.max(1, cap)) };
}

/** One anomaly as the server hands it out. `floor` and `seed` pick the floor and the spot on it. */
export interface AnomalySpawn {
  id: string;
  kind: AnomalyKind;
  floor: number;
  seed: number;
  startsAt: number;
  expiresAt: number;
  /** Signed by the server over id, floor and expiry; sent back to claim it. */
  token: string;
}

export type AnomalyReward = { kind: "coins"; coins: number } | { kind: "voucher"; coins: number };

/** A rare one pays this many coins, never more. */
export const ANOMALY_RARE_COINS = [10, 15] as const;

/**
 * What catching a kind pays, from two random bytes: usually 2–4 coins, one time in four a voucher
 * lamar worth one application; a rare one 10–15 coins.
 */
export function anomalyRewardOf(kind: AnomalyKind, a: number, b: number, applyCoins: number): AnomalyReward {
  const [lo, hi] = ANOMALY_RARE_COINS;
  if (ANOMALY_INFO[kind]?.rare) return { kind: "coins", coins: lo + (b % (hi - lo + 1)) };
  if (a < 64) return { kind: "voucher", coins: Math.max(1, applyCoins) };
  return { kind: "coins", coins: 2 + (b % 3) };
}

/** The ledger line for a catch. The collection reads it back, so keep the shapes in `anomalyKindsIn`. */
export function anomalyReason(kind: AnomalyKind, r: AnomalyReward) {
  const name = ANOMALY_INFO[kind].name;
  if (r.kind === "voucher") return `Voucher lamar dari ${name.toLowerCase()}`;
  return ANOMALY_INFO[kind].rare ? `Kejutan langka: ${name}` : `Kejutan: ${name}`;
}

/** The kinds a coin history shows were caught, from the ledger lines above. */
export function anomalyKindsIn(reasons: readonly string[]): AnomalyKind[] {
  const byName = new Map(ANOMALY_KINDS.map((k) => [ANOMALY_INFO[k].name.toLowerCase(), k] as const));
  const found = new Set<AnomalyKind>();
  for (const r of reasons) {
    const m = /^(?:Kejutan(?: langka)?: |Voucher lamar dari )(.+)$/.exec(r);
    const k = m && byName.get(m[1]!.toLowerCase());
    if (k) found.add(k);
  }
  return ANOMALY_KINDS.filter((k) => found.has(k));
}

/** Spawn ids are "a" and the slot number. */
export const anomalyId = (slot: number) => `a${slot}`;

export function anomalySlot(id: string) {
  const m = /^a(\d{1,12})$/.exec(id);
  return m ? Number(m[1]) : null;
}

/** The UTC day a slot falls on, which the daily cap counts by. */
export const anomalyDay = (slot: number) => new Date(slot * ANOMALY_SLOT_MS).toISOString().slice(0, 10);

/** What the toast says after a claim. */
export const anomalyRewardText = (r: AnomalyReward) => (r.kind === "voucher" ? `Voucher lamar 1x (+${r.coins} koin)` : `+${r.coins} koin`);
