// The price list the organiser sets: coins for what job seekers do, rupiah for what companies buy.
// Every price has a default here; the organiser's table on the server overrides any of them.

export type PriceUnit = "koin" | "rupiah";

export interface PriceItem {
  key: string;
  group: string;
  label: string;
  unit: PriceUnit;
  default: number;
  /** Highest value the organiser may set. */
  max: number;
  note?: string;
}

const KOIN = 10_000;
const RUPIAH = 1_000_000_000;

const koin = (group: string, key: string, label: string, value: number, note?: string): PriceItem => ({ key, group, label, unit: "koin", default: value, max: KOIN, ...(note ? { note } : {}) });
const rupiah = (group: string, key: string, label: string, value: number, note?: string): PriceItem => ({ key, group, label, unit: "rupiah", default: value, max: RUPIAH, ...(note ? { note } : {}) });

export const PRICE_GROUPS = ["Koin pencari kerja", "Paket koin", "Paket koin perusahaan", "Telepon & video call", "Sewa stand", "Upgrade & paket VIP", "Printilan booth"] as const;

/** Coin packages sold at the coin stand: how many coins (and bonus) each gives is fixed, the price is set here. */
export const COIN_PACKAGES = [
  { id: "koin-50", coins: 50, bonus: 0 },
  { id: "koin-120", coins: 100, bonus: 20 },
  { id: "koin-300", coins: 250, bonus: 50 },
] as const;

/**
 * Bigger coin packages for companies and food court businesses: everything they buy (a booth, a
 * food court stand, VIP, decorations) is paid in coins, topped up here through the payment gateway.
 */
export const BUSINESS_PACKAGES = [
  { id: "bisnis-5rb", coins: 5_000, bonus: 0 },
  { id: "bisnis-20rb", coins: 20_000, bonus: 1_000 },
  { id: "bisnis-40rb", coins: 40_000, bonus: 2_500 },
  { id: "bisnis-80rb", coins: 80_000, bonus: 6_000 },
] as const;

/** Every package the gateway sells, seekers' and companies'. */
export const ALL_COIN_PACKAGES = [...COIN_PACKAGES, ...BUSINESS_PACKAGES];

/** Booth extras a company can buy, by the accessory id the booth renders. */
export const ACCESSORY_DEFAULTS: { id: string; name: string; price: number }[] = [
  { id: "plant", name: "Tanaman pot", price: 0 },
  { id: "flag", name: "Umbul-umbul", price: 0 },
  { id: "standee", name: "Maskot", price: 200_000 },
  { id: "giveaway", name: "Rak merchandise", price: 250_000 },
  { id: "coffee", name: "Coffee cart", price: 500_000 },
  { id: "beanbag", name: "Bean bag", price: 250_000 },
  { id: "tv", name: "TV video profil", price: 300_000 },
  { id: "photobooth", name: "Photo booth", price: 750_000 },
  { id: "balloons", name: "Balon", price: 150_000 },
  { id: "neon", name: "Neon nama perusahaan", price: 350_000 },
  { id: "gapura", name: "Gapura", price: 400_000 },
];

export const PRICE_CATALOG: PriceItem[] = [
  koin("Koin pencari kerja", "coin.apply", "Melamar 1 lowongan", 5),
  koin("Koin pencari kerja", "coin.verify", "Centang biru (akun terverifikasi)", 60),
  koin("Koin pencari kerja", "coin.start", "Koin sambutan akun baru", 50, "Diberikan, bukan dibayar"),
  koin("Koin pencari kerja", "coin.daily", "Koin gratis harian", 20, "Diberikan, bukan dibayar"),
  koin("Koin pencari kerja", "coin.referral", "Bonus ajak teman (untuk yang mengajak dan yang diajak)", 10, "Diberikan, bukan dibayar"),
  rupiah("Paket koin", "pack.koin-50", "50 koin", 10_000),
  rupiah("Paket koin", "pack.koin-120", "100 koin + 20 bonus", 20_000),
  rupiah("Paket koin", "pack.koin-300", "250 koin + 50 bonus", 45_000),
  rupiah("Paket koin perusahaan", "coin.rupiah", "Nilai 1 koin untuk harga perusahaan", 200, "Harga perusahaan dibayar dengan koin senilai ini"),
  rupiah("Paket koin perusahaan", "pack.bisnis-5rb", "5.000 koin", 1_000_000),
  rupiah("Paket koin perusahaan", "pack.bisnis-20rb", "20.000 koin + 1.000 bonus", 4_000_000),
  rupiah("Paket koin perusahaan", "pack.bisnis-40rb", "40.000 koin + 2.500 bonus", 8_000_000),
  rupiah("Paket koin perusahaan", "pack.bisnis-80rb", "80.000 koin + 6.000 bonus", 16_000_000),
  koin("Telepon & video call", "call.2", "Telepon/video call 2 menit antar pencari kerja", 3),
  koin("Telepon & video call", "call.5", "Telepon/video call 5 menit antar pencari kerja", 6),
  koin("Telepon & video call", "call.10", "Telepon/video call 10 menit antar pencari kerja", 10),
  koin("Telepon & video call", "consult.2", "Konsultasi dengan konsultan 2 menit", 5),
  koin("Telepon & video call", "consult.5", "Konsultasi dengan konsultan 5 menit", 10),
  koin("Telepon & video call", "consult.10", "Konsultasi dengan konsultan 10 menit", 20),
  rupiah("Sewa stand", "stand.regular", "Daftar booth: stand reguler", 7_500_000),
  rupiah("Sewa stand", "stand.premium", "Daftar booth: stand VIP", 15_000_000),
  rupiah("Sewa stand", "stall", "Sewa stan food court", 750_000),
  rupiah("Upgrade & paket VIP", "product.vip", "Upgrade stand reguler ke VIP", 2_500_000),
  rupiah("Upgrade & paket VIP", "product.promoter", "NPC promotor keliling", 1_000_000),
  ...ACCESSORY_DEFAULTS.map((a) => rupiah("Printilan booth", `product.${a.id}`, a.name, a.price)),
];

const BY_KEY = new Map(PRICE_CATALOG.map((p) => [p.key, p]));

/** Prices the organiser changed, by key. */
export type Prices = Record<string, number>;

/** A price from a table, or its default. Unknown keys cost 0. */
export function priceFrom(table: Prices | null | undefined, key: string) {
  const v = table?.[key];
  return typeof v === "number" ? v : (BY_KEY.get(key)?.default ?? 0);
}

/** Keep only known keys with whole numbers in range; anything else is dropped. */
export function cleanPrices(input: unknown): Prices {
  const out: Prices = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const item = BY_KEY.get(k);
    if (!item || typeof v !== "number" || !Number.isFinite(v)) continue;
    out[k] = Math.max(0, Math.min(item.max, Math.round(v)));
  }
  return out;
}

// The price table this browser uses. The game sets it from the server; pages read it through `price`.
let current: Prices = {};

export function setPriceTable(table: Prices) {
  current = cleanPrices(table);
}

export function priceTable(): Prices {
  return current;
}

export const price = (key: string) => priceFrom(current, key);

/**
 * What a company price costs in coins. Companies and food court businesses pay everything in coins;
 * the organiser keeps their prices in rupiah and sets how much one coin is worth.
 */
export function coinsFor(table: Prices | null | undefined, rupiahPrice: number) {
  if (!(rupiahPrice > 0)) return 0;
  return Math.ceil(rupiahPrice / Math.max(1, priceFrom(table, "coin.rupiah")));
}

/** A company price in coins, from this browser's price table. */
export const coinPrice = (rupiahPrice: number) => coinsFor(current, rupiahPrice);

/** Coins as people write them: 1.250 koin. */
export const koinText = (n: number) => (n === 0 ? "Gratis" : `${n.toLocaleString("id-ID")} koin`);

/** Rupiah as people write it: Rp20.000. */
export const rp = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
