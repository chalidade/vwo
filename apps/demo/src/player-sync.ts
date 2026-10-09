// Live site: each account's own progress (coins, missions, vouchers, tickets, psikotes results,
// stamps, notifications, profile and character) is saved on the server, so it follows the player
// to any device and never carries over to another account signing in on the same browser.
import type { Account } from "./account";
import { type Character, loadCharacter, saveCharacter } from "./CharacterCreator";
import type { PlayerProgress } from "./jobfair-engine";
import { loadProfile, saveProfile, type SeekerProfile } from "./profile";
import { fair } from "./useFair";

interface Saved extends Partial<PlayerProgress> {
  profile?: SeekerProfile;
  character?: Character | null;
}

const OWNER_KEY = "vwo:player-owner";
const PUSH_MS = 4_000;
const PULL_MS = 45_000;

let stop: (() => void) | null = null;
let syncedFor: string | null = null;

function owner() {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function setOwner(id: string) {
  try {
    localStorage.setItem(OWNER_KEY, id);
  } catch {
    // Storage blocked: the server copy is what counts.
  }
}

const snapshot = (): Saved => ({ ...fair.progress(), profile: loadProfile(), character: loadCharacter() });

function adopt(d: Saved | null) {
  fair.loadProgress(d?.player ? { player: d.player, stamps: d.stamps ?? [], inbox: d.inbox ?? [] } : null);
  if (d?.profile) saveProfile(d.profile);
  if (d?.character) saveCharacter(d.character);
}

/** Keep the signed-in account's progress in step with the server; null stops it (signed out). */
export function syncPlayer(account: Account | null) {
  const id = account?.id ?? null;
  if (id === syncedFor) return;
  stop?.();
  stop = null;
  syncedFor = id;
  if (!id) return;

  let rev = -1;
  let sent = "";
  let busy = false;
  let gone = false;

  const pull = async (first = false) => {
    if (busy) return;
    busy = true;
    try {
      const r = await fetch("/api/jobfair/progress", { credentials: "same-origin" });
      if (gone || !r.ok) return;
      const d = (await r.json()) as { data: Saved | null; rev: number };
      if (first) {
        if (d.data) adopt(d.data);
        // Nothing saved yet: keep this browser's progress only if it was this account's (or nobody's).
        else if (owner() && owner() !== id) adopt(null);
        setOwner(id);
        rev = d.rev;
        sent = d.data ? JSON.stringify(snapshot()) : "";
        return;
      }
      // Another device saved; take it unless this one has changes of its own waiting to go up.
      if (d.rev !== rev && JSON.stringify(snapshot()) === sent && d.data) {
        adopt(d.data);
        rev = d.rev;
        sent = JSON.stringify(snapshot());
      }
    } catch {
      // Offline: next round.
    } finally {
      busy = false;
    }
  };

  const push = async () => {
    if (busy || rev < 0) return;
    const json = JSON.stringify(snapshot());
    if (json === sent) return;
    busy = true;
    try {
      const r = await fetch("/api/jobfair/progress", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: `{"rev":${rev},"data":${json}}`,
      });
      if (gone) return;
      const d = (await r.json().catch(() => ({}))) as { rev?: number; data?: Saved | null };
      if (r.ok && typeof d.rev === "number") {
        rev = d.rev;
        sent = json;
      } else if (r.status === 409 && typeof d.rev === "number") {
        // Another device saved first: its copy wins, and this device carries on from it.
        adopt(d.data ?? null);
        rev = d.rev;
        sent = JSON.stringify(snapshot());
      }
    } catch {
      // Offline: the change goes up next round.
    } finally {
      busy = false;
    }
  };

  const onVisible = () => {
    if (document.visibilityState === "visible") void pull();
    else void push();
  };
  void pull(true);
  const pushTimer = setInterval(() => void push(), PUSH_MS);
  const pullTimer = setInterval(() => document.visibilityState === "visible" && void pull(), PULL_MS);
  document.addEventListener("visibilitychange", onVisible);
  stop = () => {
    gone = true;
    clearInterval(pushTimer);
    clearInterval(pullTimer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
