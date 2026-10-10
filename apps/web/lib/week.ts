/** The ISO week ("2026-W41") in Jakarta time: the weekly leaderboard turns over Monday 00:00 WIB. */
export function fairWeek(now = new Date()) {
  const d = new Date(now.getTime() + 7 * 3600_000);
  const day = d.getUTCDay() || 7;
  // The Thursday of this week decides the ISO year.
  const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - day));
  const jan1 = Date.UTC(thu.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((thu.getTime() - jan1) / 86400_000 + 1) / 7);
  return `${thu.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
