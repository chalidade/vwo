// Random anomalies in the game: a cat, a puppy, fireflies, a lost balloon or a pigeon on a random
// floor for a couple of minutes. On the live site the server says which one is out (the same for
// everyone) and decides what tapping it pays; the offline demo makes its own and pays locally.
import { useSyncExternalStore } from "react";
import { ANOMALY_KINDS, ANOMALY_LIVE_MS, ANOMALY_NAMES, anomalySettings, type AnomalyKind, type AnomalyReward, type AnomalySpawn, price } from "@vwo/shared";
import { anomalyFloorId, anomalySpot } from "./fair/anomaly";
import { LIVE } from "./mode";
import { fair } from "./useFair";

export interface AnomalyHere {
  id: string;
  kind: AnomalyKind;
  name: string;
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
  const floorId = anomalyFloorId(fair.stops, spawn.floor);
  if (!floorId) return null;
  const floor = fair.floor(floorId);
  return {
    id: spawn.id,
    kind: spawn.kind,
    name: ANOMALY_NAMES[spawn.kind],
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
    spawn = d.spawn ? { ...d.spawn, until: d.spawn.expiresAt + skew } : null;
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
    kind: ANOMALY_KINDS[Math.floor(Math.random() * ANOMALY_KINDS.length)]!,
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
  if (LIVE) void run();
  else setTimeout(() => void run(), 12_000);
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

/** Tap it: the server checks and pays (the demo pays here). Returns what to tell the player. */
export async function claimAnomaly(): Promise<{ ok: true; reward: AnomalyReward; name: string } | { ok: false; text: string }> {
  const s = spawn;
  if (!s || done.has(s.id) || Date.now() >= s.until + 5000) return { ok: false, text: ERRORS.expired! };
  const name = ANOMALY_NAMES[s.kind];
  const won = (reward: AnomalyReward) => {
    done.add(s.id);
    claimed = { id: s.id, reward, at: Date.now() };
    changed();
    // Its celebration plays, then it leaves.
    setTimeout(() => {
      if (spawn?.id === s.id) spawn = null;
      changed();
    }, 1500);
    return { ok: true as const, reward, name };
  };
  if (!LIVE) {
    const reward: AnomalyReward = Math.random() < 0.25 ? { kind: "voucher", coins: price("coin.apply") } : { kind: "coins", coins: 2 + Math.floor(Math.random() * 3) };
    fair.anomalyFound(reward.coins, reward.kind === "voucher" ? `Voucher lamar dari ${name.toLowerCase()}` : `Kejutan: ${name}`);
    return won(reward);
  }
  try {
    const r = await fetch("/api/jobfair/anomaly", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, floor: s.floor, exp: s.expiresAt, token: s.token }),
    });
    const d = (await r.json().catch(() => null)) as ({ reward?: AnomalyReward; error?: string } & Partial<Parameters<typeof fair.setLedger>[0]>) | null;
    if (r.ok && d?.reward) {
      if (typeof d.balance === "number") fair.setLedger(d as Parameters<typeof fair.setLedger>[0]);
      return won(d.reward);
    }
    const error = d?.error ?? "";
    if (error === "already_claimed" || error === "expired" || error === "bad_token" || error === "daily_cap" || error === "seekers_only") {
      done.add(s.id);
      changed();
    }
    return { ok: false, text: ERRORS[error] ?? "Belum bisa, coba lagi sebentar" };
  } catch {
    return { ok: false, text: "Sedang offline, coba lagi sebentar" };
  }
}
