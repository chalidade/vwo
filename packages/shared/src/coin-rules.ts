// How job seekers earn free coins: the same rules in the game and on the server, which pays them.

/** Coins the mini games can pay out per day, so they stay a bonus rather than a coin farm. */
export const GAME_DAILY_CAP = 30;

export type MissionKind = "visit" | "apply" | "game" | "seminar" | "psych" | "greet" | "promo" | "sofa" | "read";

export interface Mission {
  id: string;
  kind: MissionKind;
  title: string;
  target: number;
  coins: number;
  xp: number;
}

export const MISSION_POOL: Mission[] = [
  { id: "visit3", kind: "visit", title: "Kunjungi 3 stand perusahaan", target: 3, coins: 6, xp: 15 },
  { id: "apply1", kind: "apply", title: "Kirim 1 lamaran", target: 1, coins: 6, xp: 15 },
  { id: "game2", kind: "game", title: "Main 2 mini game di sofa", target: 2, coins: 5, xp: 10 },
  { id: "seminar1", kind: "seminar", title: "Tonton 1 seminar sampai selesai", target: 1, coins: 8, xp: 20 },
  { id: "psych1", kind: "psych", title: "Kerjakan psikotes", target: 1, coins: 8, xp: 20 },
  { id: "greet2", kind: "greet", title: "Sapa 2 pengunjung lain", target: 2, coins: 4, xp: 10 },
  { id: "promo1", kind: "promo", title: "Simpan 1 promo atau beli voucher", target: 1, coins: 4, xp: 10 },
  { id: "sofa1", kind: "sofa", title: "Istirahat di sofa lounge", target: 1, coins: 3, xp: 5 },
  { id: "read1", kind: "read", title: "Baca 1 artikel profesi di sofa", target: 1, coins: 4, xp: 10 },
];

/** Bonus for finishing every mission of the day. */
export const MISSIONS_BONUS = 10;

/** Four missions for a day, the same for everyone: always a mini game, three others picked by date. */
export function todaysMissions(day: string): Mission[] {
  let h = 17;
  for (const ch of day) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  // A seeded shuffle of the other missions; Math.imul keeps the arithmetic exact in 32 bits.
  const rest = MISSION_POOL.filter((m) => m.kind !== "game");
  for (let i = rest.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    const j = (h >>> 8) % (i + 1);
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  const picked = rest.slice(0, 3);
  return [MISSION_POOL.find((m) => m.kind === "game")!, ...picked];
}

/** Extra coins for claiming the free daily coins several days in a row. */
export const streakBonus = (days: number) => Math.min(Math.max(days - 1, 0), 5) * 5;

