import { leaderboard, submitScore } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";
import { fairWeek } from "@/lib/week";

export const dynamic = "force-dynamic";

const game = z.enum(["2048", "catch", "memory"]);
/** What a round can honestly reach: 20 s of catching, six pairs to turn over, 2048 well past 4096. */
const LIMITS = { "2048": [0, 1_000_000], catch: [0, 100], memory: [3, 200] } as const;
const schema = z.object({ game, score: z.number().int() });

/** This week's top players of a mini game (display names only) and the signed-in player's place. */
export async function GET(req: Request) {
  const g = game.safeParse(new URL(req.url).searchParams.get("game"));
  if (!g.success) return fail(400, "bad_game");
  const user = await currentUser();
  const week = fairWeek();
  const board = await leaderboard(db, { week, game: g.data, userId: user?.id });
  return NextResponse.json({ week, ...board }, { headers: { "Cache-Control": "no-store" } });
}

/** A finished round; only the week's best counts. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`score:${user.id}`, 60, 3_600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const [lo, hi] = LIMITS[body.data.game];
  if (body.data.score < lo || body.data.score > hi) return fail(400, "bad_score");
  const best = await submitScore(db, { userId: user.id, week: fairWeek(), game: body.data.game, score: body.data.score });
  return NextResponse.json({ ok: true, best });
}
