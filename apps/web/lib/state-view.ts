import "server-only";
import { readFairState } from "@vwo/db";
import { ANNOUNCE_KEY, cleanBoard, CONSULT_CFG_KEY, type ConsultantDoc, currentAnnouncement, type PublicConsultant, publicConsultant, publicParkBuildings } from "@vwo/shared";
import { createHash } from "node:crypto";
import { PLACEMENT_KEY } from "./booths";
import { db } from "./db";
import { rentedOut } from "./stalls";

type Doc = Record<string, unknown>;
export type StateRow = { key: string; data: unknown; updatedAt: Date };

export interface StateView {
  org: Doc | null;
  companies: Record<string, Doc>;
  bookings: Doc[];
  stalls: unknown[];
  placements: Doc;
  consultants: PublicConsultant[];
  consultBotsOff: string[];
  version: number;
}

/**
 * The event as the organiser and the companies set it up, as one account may see it. Company PINs and
 * stand bookings (contact details) go to event admins only, and a company's invoices to that company's
 * accounts and the admins. With `admin` false and no booths it is the public view: the same for everyone.
 */
export function buildState(rows: StateRow[], who: { admin: boolean; mine: Set<string> }, now = Date.now()): StateView {
  const { admin, mine } = who;
  let org: Doc | null = null;
  const companies: Record<string, Doc> = {};
  const bookings: Doc[] = [];
  const stalls: unknown[] = [];
  let board: ReturnType<typeof cleanBoard> | null = null;
  let placements: Doc = {};
  const consultants: PublicConsultant[] = [];
  let consultBotsOff: string[] = [];
  let version = 0;
  for (const r of rows) {
    // A booth's inbox read marks are that company's alone (see booths/[booth]/inbox).
    if (r.key.startsWith("inbox:")) continue;
    // Seller and buyer invoice details are never part of the public setup (the read skips them too).
    if (r.key.startsWith("billing:")) continue;
    // Booth and stall requests carry contact details: organiser only, through their own route (the read skips them too).
    if (r.key.startsWith("lead:")) continue;
    // Seekers' offers are personal (the read skips them too).
    if (r.key.startsWith("offers:")) continue;
    // Lounge consultants: only the public profile, desk and open lamp, never who owns the desk or how to reach them.
    // They don't move the version: an open desk is refreshed every minute, and the game applies them on every pull.
    if (r.key.startsWith("consultant:")) {
      consultants.push(publicConsultant(r.data as ConsultantDoc, now));
      continue;
    }
    if (r.key === CONSULT_CFG_KEY) {
      consultBotsOff = ((r.data as { botsOff?: unknown }).botsOff as string[] | undefined) ?? [];
      continue;
    }
    version = Math.max(version, r.updatedAt.getTime());
    const data = r.data as Doc;
    if (r.key === ANNOUNCE_KEY) {
      board = cleanBoard(r.data);
    } else if (r.key === "org") {
      const { pins: _p, bookings: _b, ...rest } = data;
      // The park's buildings: everyone sees the ones on show; hidden ones are the organiser's alone.
      org = admin ? data : "buildings" in rest ? { ...rest, buildings: publicParkBuildings(rest.buildings) } : rest;
    } else if (r.key.startsWith("booking:")) {
      // A stand a company booked itself: everyone sees the booth, admins also the booking and PIN.
      bookings.push(admin ? { booth: data.booth, booking: data.booking, pin: data.pin } : { booth: data.booth });
    } else if (r.key === PLACEMENT_KEY) {
      // Where the organiser moved stands to: everyone's game puts them there.
      placements = (data.placements ?? {}) as Doc;
    } else if (r.key.startsWith("stall:")) {
      // A food court stand a business paid for: everyone sees it, admins also who paid.
      stalls.push(rentedOut(data, admin));
    } else if (r.key.startsWith("company:")) {
      const id = r.key.slice("company:".length);
      const { invoices: _i, ...rest } = data;
      companies[id] = admin || mine.has(id) ? data : { ...rest, invoices: [] };
    }
  }
  // Announcements live in their own document; the copy in the old setup only counts until the first change.
  if (board) {
    const { announcement: _a, ...rest } = org ?? { removed: [], added: [] };
    const shown = currentAnnouncement(board);
    org = { ...rest, ...(shown ? { announcement: { text: shown.text, at: shown.at } } : {}), ...(admin ? { announcements: board } : {}) };
  }
  return { org, companies, bookings, stalls, placements, consultants, consultBotsOff, version };
}

/** Only these are moved out: plain pictures. An SVG served from our own origin could run script. */
const IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
export const MEDIA_PATH = "/api/jobfair/state/media/";

export const mediaHash = (dataUrl: string) => createHash("sha256").update(dataUrl).digest("hex").slice(0, 32);

/**
 * Logos, booth photos and slides are inline images in the setup, often most of its size. Each one
 * longer than `max` characters is swapped for a URL named by its content's hash, which the browser
 * and the CDN keep for good; only a changed picture is downloaded again. Returns the new document and
 * the pictures by hash.
 */
export function extractMedia<T>(doc: T, max: number): { doc: T; media: Map<string, string> } {
  const media = new Map<string, string>();
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      if (v.length <= max || !v.startsWith("data:image/") || !IMAGE.test(v)) return v;
      const h = mediaHash(v);
      media.set(h, v);
      return MEDIA_PATH + h;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return { doc: walk(doc) as T, media };
}

/**
 * A document saved from a browser may carry picture URLs from the public setup instead of the
 * pictures (an older copy of another account's view): put back each one the stored document has.
 */
export function restoreMedia<T>(doc: T, stored: unknown): T {
  const have = new Map<string, string>();
  const collect = (v: unknown): void => {
    if (typeof v === "string") {
      if (v.startsWith("data:image/") && IMAGE.test(v)) have.set(mediaHash(v), v);
    } else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === "object") Object.values(v).forEach(collect);
  };
  collect(stored);
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return v.startsWith(MEDIA_PATH) ? (have.get(v.slice(MEDIA_PATH.length)) ?? knownMedia(v.slice(MEDIA_PATH.length)) ?? v) : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(doc) as T;
}

/** The bytes and type of a data URL picture. */
export function decodeImage(dataUrl: string) {
  const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.*)$/.exec(dataUrl);
  return m ? { type: m[1]!, bytes: Buffer.from(m[2]!, "base64") } : null;
}

/** Pictures of the public setups this instance built lately (the newest two), by hash. */
let known: Map<string, string>[] = [];
export function rememberMedia(media: Map<string, string>) {
  if (!media.size) return;
  known = [media, ...known].slice(0, 2);
}
export const knownMedia = (hash: string) => known.find((m) => m.has(hash))?.get(hash) ?? null;

/** The public setup and its pictures, read fresh from the database. */
export async function publicState(max: number) {
  const view = buildState(await readFairState(db), { admin: false, mine: new Set() });
  const out = extractMedia(view, max);
  rememberMedia(out.media);
  return out;
}

/** A strong validator for a response body. */
export const etagOf = (body: string) => `"${createHash("sha1").update(body).digest("base64url")}"`;

/** True when the browser's or CDN's copy (If-None-Match) is this one. */
export function matches(req: Request, etag: string) {
  const got = req.headers.get("if-none-match");
  if (!got) return false;
  return got.split(",").some((t) => t.trim().replace(/^W\//, "") === etag);
}
