// Random anomalies in the game: a cat, a puppy, fireflies, a little ghost at night, now and then a
// rare golden cat... on a random floor for a couple of minutes. On the live site the server says
// which one is out (the same for everyone) and decides what tapping it pays; the offline demo makes
// its own and pays locally.
import { useSyncExternalStore } from "react";
import {
  ANOMALY_INFO,
  ANOMALY_LIVE_MS,
  ANOMALY_NAMES,
  anomalyKindsIn,
  anomalyReason,
  anomalyRewardOf,
  anomalySettings,
  type AnomalyKind,
  type AnomalyReward,
  type AnomalySpawn,
  isAnomalyKind,
  pickAnomalyKind,
  price,
} from "@vwo/shared";
import { type Caught, anomalyFloorId, anomalySpot, anomalyStops, mergeCaught } from "./fair/anomaly";
import { LIVE } from "./mode";
import { fair } from "./useFair";

export interface AnomalyHere {
  id: string;
  kind: AnomalyKind;
  name: string;
  rare: boolean;
  floorId: string;
  x: number;
  y: number;
  /** This browser's clock. */
  until: number;
  /** Tapped and paid: shows its little celebration, then leaves. */
  claimed?: AnomalyReward;
}

let spawn: (AnomalySpawn & { until: number }) | null = null;
let claimed: { id: string; reward: AnomalyReward; at: number } | null = null;
/** Ids this browser already claimed (or was refused for), so they don't come back after a refresh. */
const done = new Set<string>();
const listeners = new Set<() => void>();
let snapshot: AnomalyHere | null = null;
let started = false;

function place(): AnomalyHere | null {
  if (!spawn) return null;
  const mine = claimed?.id === spawn.id;
  if (!mine && (Date.now() >= spawn.until || done.has(spawn.id))) return null;
  // Never on a floor the organiser closed for now; the room ones only on their room's floor.
  const stops = anomalyStops(fair.openStops(), ANOMALY_INFO[spawn.kind].place, (id) => fair.room(id)?.kind);
  const floorId = anomalyFloorId(stops, spawn.floor);
  if (!floorId) return null;
  const floor = fair.floor(floorId);
  return {
    id: spawn.id,
    kind: spawn.kind,
    name: ANOMALY_NAMES[spawn.kind],
    rare: !!ANOMALY_INFO[spawn.kind].rare,
    floorId,
    ...anomalySpot(floor, spawn.seed),
    until: spawn.until,
    claimed: mine ? claimed!.reward : undefined,
  };
}

function changed() {
  const next = place();
  if (JSON.stringify(next) === JSON.stringify(snapshot)) return;
  snapshot = next;
  listeners.forEach((fn) => fn());
}

/** The anomaly out now, with its floor and spot, or null. */
export function useAnomaly() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => snapshot,
  );
}

async function poll(): Promise<number> {
  try {
    const r = await fetch("/api/jobfair/anomaly", { credentials: "same-origin" });
    if (!r.ok) return 60_000;
    const d = (await r.json()) as { spawn: AnomalySpawn | null; next: number; now?: number };
    const now = Date.now();
    const skew = typeof d.now === "number" ? now - d.now : 0;
    // A kind this page doesn't know yet (an older tab after a deploy) is skipped rather than drawn wrong.
    spawn = d.spawn && isAnomalyKind(d.spawn.kind) ? { ...d.spawn, until: d.spawn.expiresAt + skew } : null;
    changed();
    return Math.min(6 * 60_000, Math.max(15_000, d.next + skew - now + 500));
  } catch {
    return 60_000;
  }
}

/** The offline demo: a new one every few minutes, the first one soon after opening. */
function demoSpawn(): number {
  const now = Date.now();
  if (!anomalySettings(fair.org).on) {
    spawn = null;
    changed();
    return 30_000;
  }
  const id = `demo-${now}`;
  spawn = {
    id,
    kind: pickAnomalyKind(Math.random(), now),
    floor: Math.floor(Math.random() * 1e9),
    seed: Math.floor(Math.random() * 1e9),
    startsAt: now,
    expiresAt: now + ANOMALY_LIVE_MS,
    token: "demo",
    until: now + ANOMALY_LIVE_MS,
  };
  changed();
  return ANOMALY_LIVE_MS + 60_000 + Math.random() * 120_000;
}

/** Start showing anomalies. Safe to call again. */
export function startAnomalies() {
  if (started) return;
  started = true;
  const run = async () => {
    const wait = LIVE ? await poll() : demoSpawn();
    setTimeout(() => void run(), wait);
  };
  if (LIVE) {
    void run();
    void loadAnomalyCollection();
  } else setTimeout(() => void run(), 12_000);
  // Leave on time even when no request comes in between.
  setInterval(changed, 1000);
}

const ERRORS: Record<string, string> = {
  not_signed_in: "Masuk dulu untuk menangkapnya",
  already_claimed: "Yang ini sudah kamu tangkap",
  daily_cap: "Jatah kejutan hari ini sudah habis, coba lagi besok",
  expired: "Yah, keburu pergi",
  not_yet: "Yah, keburu pergi",
  off: "Kejutan sedang dimatikan panitia",
  seekers_only: "Kejutan ini khusus pencari kerja",
  too_many_requests: "Pelan-pelan, coba lagi sebentar",
};

const CAUGHT_KEY = "vwo-anomaly-caught";

/** This browser's own record of catches: when, and on which floor. */
function caughtHere(): Caught[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CAUGHT_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((c: unknown) => {
      const o = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
      if (!isAnomalyKind(o.kind) || typeof o.at !== "number") return [];
      return [{ kind: o.kind, at: o.at, ...(typeof o.where === "string" ? { where: o.where.slice(0, 80) } : {}) }];
    });
  } catch {
    return [];
  }
}

function rememberCaught(c: Caught) {
  try {
    const all = mergeCaught([caughtHere(), [c]]);
    localStorage.setItem(CAUGHT_KEY, JSON.stringify([...all.values()]));
  } catch {
    // Private window: the server's list (or the coin history) still shows them.
  }
  collectionChanged();
}

/** What the server says this account caught (live only), once asked. */
let serverCaught: Caught[] = [];
const collectionListeners = new Set<() => void>();
let collectionVersion = 0;
const collectionChanged = () => {
  collectionVersion++;
  collectionListeners.forEach((fn) => fn());
};

/** Ask the server for this account's collection (live only). */
export async function loadAnomalyCollection() {
  if (!LIVE) return;
  try {
    const r = await fetch("/api/jobfair/anomaly?mine=1", { credentials: "same-origin" });
    if (!r.ok) return;
    const d = (await r.json()) as { caught?: { kind?: unknown; at?: unknown }[] };
    serverCaught = (d.caught ?? []).flatMap((c) => (isAnomalyKind(c.kind) && typeof c.at === "number" ? [{ kind: c.kind, at: c.at }] : []));
    collectionChanged();
  } catch {
    // Offline: what this browser knows.
  }
}

/** The kinds the player has caught, each with when and (when this browser saw it) where. */
export function anomalyCollection(): Map<AnomalyKind, Caught> {
  const fromLedger = fair.player.txns.flatMap((t) => anomalyKindsIn([t.reason]).map((kind) => ({ kind, at: t.at })));
  if (!LIVE) return mergeCaught([caughtHere(), fromLedger]);
  // Live: the account's own record decides what is caught (this browser may have had another
  // account); this browser only adds where it happened.
  const all = mergeCaught([serverCaught, fromLedger]);
  for (const c of caughtHere()) {
    const got = all.get(c.kind);
    if (got && !got.where && c.where) all.set(c.kind, { ...got, where: c.where });
  }
  return all;
}

/** Re-render when the collection changes. */
export function useAnomalyCollection() {
  useSyncExternalStore(
    (fn) => {
      collectionListeners.add(fn);
      return () => collectionListeners.delete(fn);
    },
    () => collectionVersion,
  );
  // The game re-renders every frame: work it out again only when a catch or the coin history changed.
  const t = fair.player.txns;
  const key = `${collectionVersion}:${t.length}:${t[0]?.at ?? 0}`;
  if (cachedCollection?.key !== key) cachedCollection = { key, value: anomalyCollection() };
  return cachedCollection.value;
}
let cachedCollection: { key: string; value: Map<AnomalyKind, Caught> } | null = null;

/** Where the player is catching it: "Lantai 3 · Teknologi". */
function whereOf(floorId: string | undefined) {
  if (!floorId) return undefined;
  const st = fair.stopOf(floorId);
  return `${st.name} · ${st.label}`;
}

/** Tap it: the server checks and pays (the demo pays here). Each kind pays only the first time; after
 *  that it is already in the collection. Returns what to tell the player. */
export async function claimAnomaly(): Promise<{ ok: true; reward: AnomalyReward; name: string; line: string; rare: boolean } | { ok: false; text: string }> {
  const s = spawn;
  if (!s || done.has(s.id) || Date.now() >= s.until + 5000) return { ok: false, text: ERRORS.expired! };
  const where = whereOf(snapshot?.id === s.id ? snapshot.floorId : undefined);
  const won = (reward: AnomalyReward, kind: AnomalyKind) => {
    done.add(s.id);
    rememberCaught({ kind, at: Date.now(), where });
    claimed = { id: s.id, reward, at: Date.now() };
    changed();
    // Its celebration plays, then it leaves.
    setTimeout(() => {
      if (spawn?.id === s.id) spawn = null;
      changed();
    }, 1500);
    const info = ANOMALY_INFO[kind];
    return { ok: true as const, reward, name: info.name, line: info.line, rare: !!info.rare };
  };
  const again = (kind: AnomalyKind) => {
    done.add(s.id);
    changed();
    return { ok: false as const, text: `${ANOMALY_NAMES[kind]} sudah ada di koleksimu, bonusnya cuma sekali` };
  };
  if (!LIVE) {
    if (anomalyCollection().has(s.kind)) return again(s.kind);
    const byte = () => Math.floor(Math.random() * 256);
    const reward = anomalyRewardOf(s.kind, byte(), byte(), price("coin.apply"));
    fair.anomalyFound(reward.coins, anomalyReason(s.kind, reward));
    return won(reward, s.kind);
  }
  try {
    const r = await fetch("/api/jobfair/anomaly", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, floor: s.floor, exp: s.expiresAt, token: s.token }),
    });
    const d = (await r.json().catch(() => null)) as ({ reward?: AnomalyReward; kind?: string; error?: string } & Partial<Parameters<typeof fair.setLedger>[0]>) | null;
    if (r.ok && d?.reward) {
      if (typeof d.balance === "number") fair.setLedger(d as Parameters<typeof fair.setLedger>[0]);
      // The server's word on what it was.
      return won(d.reward, isAnomalyKind(d.kind) ? d.kind : s.kind);
    }
    const error = d?.error ?? "";
    if (error === "already_collected") return again(isAnomalyKind(d?.kind) ? d.kind : s.kind);
    if (error === "already_claimed" || error === "expired" || error === "bad_token" || error === "daily_cap" || error === "seekers_only") {
      done.add(s.id);
      changed();
    }
    return { ok: false, text: ERRORS[error] ?? "Belum bisa, coba lagi sebentar" };
  } catch {
    return { ok: false, text: "Sedang offline, coba lagi sebentar" };
  }
}
