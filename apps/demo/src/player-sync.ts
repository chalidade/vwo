// Live site: each account's own progress (coins, missions, vouchers, tickets, psikotes results,
// stamps, notifications, profile and character) is saved on the server, so it follows the player
// to any device and never carries over to another account signing in on the same browser.
import type { Account } from "./account";
import { type Character, loadCharacter, saveCharacter } from "./CharacterCreator";
import type { PlayerProgress } from "./jobfair-engine";
import { PROFILE_EVENT, loadProfile, saveProfile, type SeekerProfile } from "./profile";
import { coinsPending } from "./coin-sync";
import { pollVisible } from "./poll";
import { runtimeConfig } from "./runtime-config";
import { fair } from "./useFair";

interface Saved extends Partial<PlayerProgress> {
  profile?: SeekerProfile;
  character?: Character | null;
}

const OWNER_KEY = "vwo:player-owner";

let stop: (() => void) | null = null;
/** Ask the server for this account's copy now (after the server itself changed it). */
let pullNow: (() => void) | null = null;
let syncedFor: string | null = null;
/** The signed-in account's saved progress has been loaded (so coins added now are not overwritten). */
let ready = false;
const waiting: (() => void)[] = [];

/** Run once this account's progress is loaded from the server. */
export function whenPlayerReady(fn: () => void) {
  if (ready) fn();
  else waiting.push(fn);
}

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

type Ledger = Parameters<typeof fair.setLedger>[0];

/** The server's ledger balance that came with a save or load, unless coin changes are still on their way. */
function ledger(c: Ledger | undefined) {
  if (c && !coinsPending()) fair.setLedger(c);
}

function adopt(d: Saved | null) {
  fair.loadProgress(d?.player ? { player: d.player, stamps: d.stamps ?? [], inbox: d.inbox ?? [] } : null);
  if (d?.profile) {
    saveProfile(d.profile);
    window.dispatchEvent(new Event(PROFILE_EVENT));
  }
  if (d?.character) saveCharacter(d.character);
}

/** Fetch the saved progress now, e.g. after a pre-registration filled the profile on the server. */
export const refreshPlayer = () => pullNow?.();

/** Keep the signed-in account's progress in step with the server; null stops it (signed out). */
export function syncPlayer(account: Account | null) {
  const id = account?.id ?? null;
  if (id === syncedFor) return;
  stop?.();
  stop = null;
  syncedFor = id;
  ready = false;
  waiting.length = 0;
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
      const d = (await r.json()) as { data: Saved | null; rev: number; coins?: Ledger };
      if (first) {
        if (d.data) adopt(d.data);
        // Nothing saved yet: keep this browser's progress only if it was this account's (or nobody's).
        else if (owner() && owner() !== id) adopt(null);
        setOwner(id);
        rev = d.rev;
        sent = d.data ? JSON.stringify(snapshot()) : "";
        ledger(d.coins);
        ready = true;
        waiting.splice(0).forEach((fn) => fn());
        return;
      }
      // Another device saved; take it unless this one has changes of its own waiting to go up. With
      // nothing saved before (rev 0) the server's copy wins, as the first save would find anyway.
      if (d.rev !== rev && (rev === 0 || JSON.stringify(snapshot()) === sent) && d.data) {
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
      const d = (await r.json().catch(() => ({}))) as { rev?: number; data?: Saved | null; coins?: Ledger };
      if (r.ok && typeof d.rev === "number") {
        rev = d.rev;
        sent = json;
        ledger(d.coins);
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

  // Leaving the tab saves at once; coming back pulls (pollVisible).
  const onVisible = () => document.visibilityState === "hidden" && void push();
  void pull(true);
  pullNow = () => void pull();
  // Saves only go up when something changed, at most every PROGRESS_PUSH_SEC.
  let pushTimer: ReturnType<typeof setTimeout>;
  const pushSoon = () => {
    pushTimer = setTimeout(() => {
      void push();
      if (!gone) pushSoon();
    }, runtimeConfig().progressPushSec * 1000);
  };
  pushSoon();
  const stopPull = pollVisible(
    () => void pull(),
    () => runtimeConfig().progressPollSec,
    { now: false },
  );
  document.addEventListener("visibilitychange", onVisible);
  stop = () => {
    gone = true;
    pullNow = null;
    clearTimeout(pushTimer);
    stopPull();
    document.removeEventListener("visibilitychange", onVisible);
  };
}
