// Random anomalies: a cat, a puppy, fireflies, a lost balloon or a pigeon that turns up on a random
// floor for a short while. Tapping one gives a few coins or a "voucher lamar" (the coins for one
// application). The server decides when and where each one appears (from the clock and a secret, so
// every visitor sees the same one) and what it pays; the game only draws it.

export const ANOMALY_KINDS = ["cat", "dog", "fireflies", "balloon", "pigeon"] as const;
export type AnomalyKind = (typeof ANOMALY_KINDS)[number];

export const ANOMALY_NAMES: Record<AnomalyKind, string> = {
  cat: "Kucing oren",
  dog: "Anak anjing",
  fireflies: "Kunang-kunang",
  balloon: "Balon nyasar",
  pigeon: "Burung merpati",
};

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
