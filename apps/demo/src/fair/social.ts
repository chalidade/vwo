// Quick messages from one job seeker to another: a greeting, "follow me", "come to floor 3". They
// travel over the presence channel to one person only, and only as a key from this fixed list (plus
// a floor id), so nobody can push free text, links or insults onto someone else's screen.

export type PingKey =
  | "hi"
  | "team"
  | "follow"
  | "floor"
  | "here"
  | "wait"
  | "where"
  | "ok"
  | "later"
  | "following"
  | "coming"
  | "thanks"
  | "hiback";

export interface Ping {
  key: PingKey;
  /** For "floor" and "here": the floor meant. */
  floorId?: string;
}

/** What a ping says on the receiver's screen. `floor` is the floor's display name. */
export const PING_TEXT: Record<PingKey, (floor: string) => string> = {
  hi: () => "👋 Hai! Salam kenal",
  team: () => "🤝 Cari kerja bareng yuk?",
  follow: () => "🚶 Ikuti aku ya!",
  floor: (f) => `🛗 Ayo ke ${f}!`,
  here: (f) => `📍 Aku di sini, ${f}`,
  wait: () => "⏳ Tunggu aku ya",
  where: () => "🔎 Kamu di mana?",
  ok: () => "👍 Oke, otw!",
  later: () => "🙏 Nanti ya",
  following: () => "👣 Oke, aku ikutin kamu",
  coming: () => "🏃 Aku ke sana!",
  thanks: () => "😊 Makasih!",
  hiback: () => "👋 Hai juga!",
};

/** What a sender can start with, in menu order. "floor" is offered per floor separately. */
export const PING_STARTERS: PingKey[] = ["hi", "team", "follow", "here", "where", "wait"];
/** Quick answers offered on an incoming ping. */
export const PING_REPLIES: PingKey[] = ["ok", "hiback", "thanks", "later"];

const KEYS = new Set<string>(Object.keys(PING_TEXT));
const FLOOR_ID = /^[\w-]{1,40}$/;

/** A ping read off the wire, or null when it is not one we know. */
export function parsePing(raw: unknown): Ping | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as { key?: unknown; floorId?: unknown };
  if (typeof m.key !== "string" || !KEYS.has(m.key)) return null;
  const key = m.key as PingKey;
  if (key === "floor" || key === "here") {
    if (typeof m.floorId !== "string" || !FLOOR_ID.test(m.floorId)) return null;
    return { key, floorId: m.floorId };
  }
  return { key };
}

/** Lets each sender through at most `burst` pings per `windowMs`, so nobody can flood a screen. */
export class PingLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly burst = 3,
    private readonly windowMs = 20_000,
  ) {}

  allow(from: string, now = Date.now()) {
    const recent = (this.hits.get(from) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.burst) {
      this.hits.set(from, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(from, recent);
    return true;
  }
}
