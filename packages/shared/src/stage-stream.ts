// Seminar and Aula broadcasts that scale past a handful of viewers. The speaker's browser can send its
// screen to only a few people over WebRTC (one connection each), so for a crowd the organiser streams
// to YouTube Live (or Vimeo) and pastes the link; viewers in the game watch that player. The built-in
// mesh stays as a fallback, capped, and the stage chat is kept within the Supabase Realtime budget.

/** An external live stream the viewer can play: always rebuilt from the provider's id, never the link as typed. */
export interface StreamEmbed {
  provider: "youtube" | "vimeo";
  /** The iframe's src. */
  src: string;
  /** The same stream on the provider's own site, for "Buka di YouTube". */
  watch: string;
}

/** A pasted link is never longer than this. */
export const STREAM_URL_MAX = 300;

const YOUTUBE = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const VIMEO = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);
const YT_ID = /^[\w-]{11}$/;
const YT_CHANNEL = /^UC[\w-]{22}$/;
const VIMEO_ID = /^\d{1,12}$/;
const VIMEO_HASH = /^[0-9a-f]{6,20}$/;

function youtube(id: string): StreamEmbed {
  return { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`, watch: `https://www.youtube.com/watch?v=${id}` };
}

/**
 * The embeddable player for a link the organiser pasted, or null when it is not a YouTube or Vimeo
 * video, live, or channel link. Only these hosts are allowed, so the viewer never frames another site.
 *
 * YouTube: youtu.be/ID, youtube.com/watch?v=ID, /live/ID, /embed/ID, /shorts/ID, and /channel/UC…/live
 * (the channel's current live stream, so one link works for the whole day).
 * Vimeo: vimeo.com/ID, vimeo.com/ID/HASH (unlisted), vimeo.com/event/ID (live events), player.vimeo.com/video/ID.
 */
export function streamEmbed(raw: unknown): StreamEmbed | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.length > STREAM_URL_MAX) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  if (YOUTUBE.has(host)) {
    if (host === "youtu.be") return parts.length === 1 && YT_ID.test(parts[0]!) ? youtube(parts[0]!) : null;
    if (parts[0] === "watch" && parts.length === 1) {
      const v = u.searchParams.get("v");
      return v && YT_ID.test(v) ? youtube(v) : null;
    }
    if ((parts[0] === "live" || parts[0] === "embed" || parts[0] === "shorts") && parts.length === 2 && YT_ID.test(parts[1]!)) return youtube(parts[1]!);
    if (parts[0] === "channel" && parts[2] === "live" && parts.length === 3 && YT_CHANNEL.test(parts[1]!))
      return {
        provider: "youtube",
        src: `https://www.youtube-nocookie.com/embed/live_stream?channel=${parts[1]}&autoplay=1&playsinline=1`,
        watch: `https://www.youtube.com/channel/${parts[1]}/live`,
      };
    return null;
  }
  if (VIMEO.has(host)) {
    let id: string | undefined;
    let hash = u.searchParams.get("h") ?? undefined;
    if (host === "player.vimeo.com") id = parts[0] === "video" && parts.length === 2 ? parts[1] : undefined;
    else if (parts[0] === "event" && (parts.length === 2 || (parts.length === 3 && parts[2] === "embed")) && VIMEO_ID.test(parts[1]!))
      return { provider: "vimeo", src: `https://vimeo.com/event/${parts[1]}/embed?autoplay=1`, watch: `https://vimeo.com/event/${parts[1]}` };
    else if (parts.length === 1 || parts.length === 2) {
      id = parts[0];
      if (parts.length === 2) hash = parts[1];
    }
    if (!id || !VIMEO_ID.test(id) || (hash !== undefined && !VIMEO_HASH.test(hash))) return null;
    const h = hash ? `&h=${hash}` : "";
    return { provider: "vimeo", src: `https://player.vimeo.com/video/${id}?autoplay=1&playsinline=1${h}`, watch: `https://vimeo.com/${id}${hash ? `/${hash}` : ""}` };
  }
  return null;
}

/** Where a session or Aula item is broadcast from: "platform" (default) is the speaker's browser straight to
 *  a few viewers; "link" is YouTube or Vimeo, for a crowd. */
export type StreamSource = "platform" | "link";

/** The organiser chose YouTube or Vimeo for this item (whether or not the link is filled in yet). */
export const usesStreamLink = (x: { streamSource?: unknown } | null | undefined) => x?.streamSource === "link";

/** The link to keep in the organiser's setup: trimmed when it plays, nothing otherwise. */
export function cleanStreamUrl(raw: unknown): string | undefined {
  return streamEmbed(raw) ? (raw as string).trim() : undefined;
}

// ---- Limits, from the server's env (see docs/deploy/vercel-supabase.md) -----------------------

export interface StageConfig {
  /** Viewers the speaker's browser streams to directly (WebRTC mesh); the rest get slides only. */
  meshMaxViewers: number;
  /** How often a live speaker tells everyone it is on air, in seconds. */
  beatSec: number;
  /** Viewers can chat, ask questions and react. */
  chatEnabled: boolean;
  /** Least seconds between two chat messages from one viewer. */
  chatCooldownSec: number;
  /** Least seconds between two reactions from one viewer. */
  reactCooldownSec: number;
  /** Realtime messages per second the room's chat and reactions may cost, everyone receiving them counted. */
  chatBudget: number;
}

/** Sized for Supabase Free (100 messages per second for the whole project, each receiver counted). */
export const STAGE_DEFAULTS: StageConfig = { meshMaxViewers: 8, beatSec: 10, chatEnabled: true, chatCooldownSec: 10, reactCooldownSec: 3, chatBudget: 30 };

const LIMITS: Record<Exclude<keyof StageConfig, "chatEnabled">, [number, number]> = {
  meshMaxViewers: [0, 100],
  beatSec: [2, 60],
  chatCooldownSec: [0, 600],
  reactCooldownSec: [0, 600],
  chatBudget: [1, 100_000],
};

const clampNum = (v: unknown, [lo, hi]: [number, number], fallback: number) => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : fallback;
};
const flag = (v: unknown, fallback: boolean) => {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string" || !v.trim()) return fallback;
  return !/^(0|false|off|no)$/i.test(v.trim());
};

/** The stage limits from env vars (STAGE_MESH_MAX_VIEWERS, STAGE_BEAT_SEC, STAGE_CHAT_ENABLED, STAGE_CHAT_COOLDOWN_SEC,
 *  STAGE_REACT_COOLDOWN_SEC, STAGE_CHAT_BUDGET); anything unset or unreadable keeps its default. */
export function stageConfigFromEnv(env: Record<string, string | undefined>): StageConfig {
  return cleanStageConfig({
    meshMaxViewers: env.STAGE_MESH_MAX_VIEWERS,
    beatSec: env.STAGE_BEAT_SEC,
    chatEnabled: env.STAGE_CHAT_ENABLED,
    chatCooldownSec: env.STAGE_CHAT_COOLDOWN_SEC,
    reactCooldownSec: env.STAGE_REACT_COOLDOWN_SEC,
    chatBudget: env.STAGE_CHAT_BUDGET,
  });
}

/** Stage limits as received (from env or over the network), each within its range. */
export function cleanStageConfig(x: unknown): StageConfig {
  const c = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  return {
    meshMaxViewers: clampNum(c.meshMaxViewers, LIMITS.meshMaxViewers, STAGE_DEFAULTS.meshMaxViewers),
    beatSec: clampNum(c.beatSec, LIMITS.beatSec, STAGE_DEFAULTS.beatSec),
    chatEnabled: flag(c.chatEnabled, STAGE_DEFAULTS.chatEnabled),
    chatCooldownSec: clampNum(c.chatCooldownSec, LIMITS.chatCooldownSec, STAGE_DEFAULTS.chatCooldownSec),
    reactCooldownSec: clampNum(c.reactCooldownSec, LIMITS.reactCooldownSec, STAGE_DEFAULTS.reactCooldownSec),
    chatBudget: clampNum(c.chatBudget, LIMITS.chatBudget, STAGE_DEFAULTS.chatBudget),
  };
}

/** Whether the speaker streams to this viewer directly: one already connected keeps their place, a new one needs a free one. */
export function meshAdmit(viewers: Iterable<string>, viewerId: string, cap: number) {
  let n = 0;
  for (const v of viewers) {
    if (v === viewerId) return true;
    n++;
  }
  return n < cap;
}

/** How long a viewer waits before the next chat message or reaction, in ms (0: send now).
 *
 *  Every message in the room reaches every watcher, so with W watchers and a budget of B delivered
 *  messages per second the whole room may send B / W messages per second. Each viewer counts what it
 *  saw in the last window (at least 10 seconds) and holds back once the room is at that rate: a quiet
 *  room chats freely, a full one slows down ("mode lambat"). On top, each viewer has its own cooldown. */
export function stageSendWait(o: { now: number; last: number; recent: readonly number[]; watchers: number; cooldownMs: number; budget: number }) {
  const own = o.last + o.cooldownMs - o.now;
  const watchers = Math.max(1, o.watchers);
  const budget = Math.max(1, o.budget);
  const windowMs = Math.max(10_000, (watchers / budget) * 1000);
  const allowed = Math.max(1, Math.floor(((windowMs / 1000) * budget) / watchers));
  const seen = o.recent.filter((t) => t > o.now - windowMs && t <= o.now).sort((a, b) => a - b);
  const room = seen.length < allowed ? 0 : seen[seen.length - allowed]! + windowMs - o.now;
  return Math.max(0, Math.ceil(own), Math.ceil(room));
}

/** Milliseconds a viewer waits for the next "on air" message before taking the speaker as gone. */
export const stageStaleMs = (beatSec: number) => (Math.max(2, beatSec) * 3 + 2) * 1000;
