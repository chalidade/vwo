// The weekly mini game leaderboard. Live: every account's best of the week, kept on the server.
// The demo ranks this browser's best against a few made-up players.
import { LIVE } from "../mode";

export type ScoreGame = "2048" | "catch" | "memory";
export interface BoardRow {
  name: string;
  best: number;
  tag?: string;
}
export interface Board {
  top: BoardRow[];
  me: { best: number; rank: number } | null;
}

export const SCORE_GAMES: { id: ScoreGame; name: string; unit: string }[] = [
  { id: "2048", name: "2048", unit: "skor" },
  { id: "catch", name: "Tangkap Koin", unit: "poin" },
  { id: "memory", name: "Memory Logo", unit: "langkah" },
];
export const lowerIsBetter = (g: ScoreGame) => g === "memory";

const DEMO_KEY = "vwo:scores";
const DEMO_RIVALS: Record<ScoreGame, [string, number][]> = {
  "2048": [["Raka", 5120], ["Dimas", 3240], ["Sari", 2210], ["Nadia", 1380], ["Bayu", 760]],
  catch: [["Nadia", 41], ["Raka", 36], ["Putri", 30], ["Dimas", 24], ["Bayu", 17]],
  memory: [["Sari", 8], ["Putri", 10], ["Raka", 12], ["Dimas", 15], ["Nadia", 19]],
};

/** Monday of this week, so the demo's best also starts over each week. */
function weekKey() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function demoBest(): Record<string, number> {
  try {
    const all = JSON.parse(localStorage.getItem(DEMO_KEY) ?? "{}") as { week?: string; best?: Record<string, number> };
    return all.week === weekKey() ? (all.best ?? {}) : {};
  } catch {
    return {};
  }
}

/** Send a finished round. Only the week's best counts; a worse round changes nothing. */
export async function submitScore(game: ScoreGame, score: number) {
  if (!LIVE) {
    const best = demoBest();
    const old = best[game];
    if (old === undefined || (lowerIsBetter(game) ? score < old : score > old)) best[game] = score;
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify({ week: weekKey(), best }));
    } catch {
      // Private mode.
    }
    return;
  }
  await fetch("/api/jobfair/scores", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game, score }) }).catch(() => undefined);
}

export async function loadBoard(game: ScoreGame, myName: string): Promise<Board | null> {
  if (!LIVE) {
    const mine = demoBest()[game];
    const rows: BoardRow[] = DEMO_RIVALS[game].map(([name, best]) => ({ name, best }));
    if (mine !== undefined) rows.push({ name: myName, best: mine, tag: "me" });
    rows.sort((a, b) => (lowerIsBetter(game) ? a.best - b.best : b.best - a.best));
    const rank = rows.findIndex((r) => r.tag === "me");
    return { top: rows, me: mine === undefined ? null : { best: mine, rank: rank + 1 } };
  }
  try {
    const r = await fetch(`/api/jobfair/scores?game=${game}`, { credentials: "same-origin" });
    return r.ok ? ((await r.json()) as Board) : null;
  } catch {
    return null;
  }
}
