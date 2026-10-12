// How players online stay within a realtime plan's message budget. Supabase counts a broadcast
// once when sent and once per receiver, so a message on a floor channel of n people costs n.
// Three rules keep the total bounded however busy the fair gets:
// - a floor channel holds at most `floorCap` people; more open a second channel ("shard"), and so on;
// - every channel shares one allowance of broadcasts per second, budget / people online, so the
//   sum over all channels stays under the budget even if every channel is full and busy;
// - inside a channel the allowance is shared fairly between whoever is moving or talking.

/** Channels per floor before newcomers squeeze into the emptiest one. */
export const MAX_SHARDS = 8;

/**
 * Which floor channel to look at or join next, given the occupants of those looked at so far.
 * The lowest channel with people and room wins, so people meet; an empty channel is only
 * chosen after checking that the next one is not a better (busier, not full) choice.
 * `prefer` (a friend's channel) is tried first when it has room.
 */
export function nextShard(counts: ReadonlyMap<number, number>, cap: number, prefer = -1, max = MAX_SHARDS): { probe: number } | { pick: number } {
  if (prefer >= 0 && prefer < max) {
    const n = counts.get(prefer);
    if (n === undefined) return { probe: prefer };
    if (n < cap) return { pick: prefer };
  }
  let firstEmpty = -1;
  for (let i = 0; i < max; i++) {
    const n = counts.get(i);
    if (n === undefined) return { probe: i };
    if (n > 0 && n < cap) return { pick: i };
    if (n === 0 && firstEmpty < 0) firstEmpty = i;
    if (firstEmpty >= 0 && i > firstEmpty) break;
  }
  if (firstEmpty >= 0) return { pick: firstEmpty };
  // Every channel full: the emptiest one takes one more.
  let best = 0;
  for (let i = 1; i < max; i++) if ((counts.get(i) ?? 0) < (counts.get(best) ?? 0)) best = i;
  return { pick: best };
}

/** Broadcasts per second one channel may carry: the budget shared by everyone who may be online. */
export function shardRate(msgBudget: number, onlineEstimate: number, maxConnections: number) {
  // Assume a quarter more people than we last heard of, at least a small crowd, at most the cap.
  const cap = maxConnections > 0 ? maxConnections : Infinity;
  const people = Math.min(cap, Math.max(10, Math.ceil(onlineEstimate * 1.25)));
  return msgBudget / Math.max(1, people);
}

/**
 * The broadcasts heard on one channel lately, and whether one more may go now.
 * Everyone on a channel hears the same broadcasts, so they all reach the same answer.
 */
export class ShardBudget {
  private log: { at: number; from: string }[] = [];

  constructor(
    readonly windowMs = 10_000,
    /** Even alone on a quiet channel, one player sends at most this often. */
    readonly minGapMs = 400,
  ) {}

  /** A broadcast went out on this channel (anyone's, ours included). */
  heard(from: string, at: number) {
    this.log.push({ from, at });
    this.prune(at);
  }

  clear() {
    this.log = [];
  }

  private prune(now: number) {
    let i = 0;
    while (i < this.log.length && now - this.log[i]!.at >= this.windowMs) i++;
    if (i) this.log.splice(0, i);
  }

  /** May `me` broadcast now, with the channel allowed `perSec` broadcasts a second? */
  allow(me: string, now: number, perSec: number) {
    this.prune(now);
    const allowance = Math.max(1, (perSec * this.windowMs) / 1000);
    if (this.log.length + 1 > allowance) return false;
    let mine = 0;
    let lastMine = -Infinity;
    let lastSecond = 0;
    const senders = new Set<string>([me]);
    for (const e of this.log) {
      senders.add(e.from);
      if (now - e.at < 1000) lastSecond++;
      if (e.from === me) {
        mine++;
        lastMine = e.at;
      }
    }
    if (now - lastMine < this.minGapMs) return false;
    // Spread out: at most twice the average rate within any one second.
    if (lastSecond + 1 > Math.max(1, Math.ceil(perSec * 2))) return false;
    // A fair share: one busy player can't starve the others on the channel.
    return mine + 1 <= Math.max(1, Math.floor(allowance / senders.size));
  }
}

/** Chat bubbles one player may send a minute. */
export class ChatLimit {
  private sent: number[] = [];
  constructor(private readonly perMin: number) {}
  allow(now: number) {
    this.sent = this.sent.filter((t) => now - t < 60_000);
    if (this.sent.length >= this.perMin) return false;
    this.sent.push(now);
    return true;
  }
}
