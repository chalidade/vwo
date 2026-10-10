// Friends met at the fair. Live: kept on the server by each account's public tag, so a friend
// stays a friend on every device and every visit. The demo keeps them in this browser.
import { useSyncExternalStore } from "react";
import { LIVE } from "../mode";

export type FriendState = "friend" | "sent" | "received";
export interface Friend {
  tag: string;
  name: string;
  state: FriendState;
}

interface Store {
  tag: string | null;
  friends: Friend[];
}

const KEY = "vwo:friends";
const TAG_KEY = "vwo:fair-tag";
let store: Store = { tag: null, friends: [] };
const listeners = new Set<() => void>();

function set(next: Store) {
  store = next;
  if (!LIVE) {
    try {
      localStorage.setItem(KEY, JSON.stringify(next.friends));
    } catch {
      // Private mode: friends last until the tab closes.
    }
  }
  for (const l of listeners) l();
}

/** The demo's stand-in for an account tag: random, kept in this browser. */
function demoTag() {
  try {
    const saved = localStorage.getItem(TAG_KEY);
    if (saved && /^[0-9a-f]{12}$/.test(saved)) return saved;
    const t = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(TAG_KEY, t);
    return t;
  } catch {
    return null;
  }
}

async function api(method: "POST" | "DELETE", tag: string) {
  const r = await fetch("/api/jobfair/friends", { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tag }) });
  return (await r.json().catch(() => ({}))) as { state?: FriendState };
}

/** Load the friend list (after signing in, and now and then for requests from others). */
export async function loadFriends() {
  if (!LIVE) {
    let friends: Friend[] = [];
    try {
      friends = (JSON.parse(localStorage.getItem(KEY) ?? "[]") as Friend[]).filter((f) => f && typeof f.tag === "string" && typeof f.name === "string");
    } catch {
      // Nothing saved.
    }
    set({ tag: demoTag(), friends });
    return;
  }
  try {
    const r = await fetch("/api/jobfair/friends", { credentials: "same-origin" });
    if (!r.ok) return;
    const d = (await r.json()) as { tag?: string; friends?: Friend[] };
    set({ tag: d.tag ?? null, friends: d.friends ?? [] });
  } catch {
    // Offline: keep what we have.
  }
}

/** Ask someone to be friends, or say yes to them. Returns the new state, or null when it failed. */
export async function addFriend(tag: string, name: string): Promise<FriendState | null> {
  let state: FriendState | null;
  if (!LIVE) state = "friend";
  else {
    try {
      state = (await api("POST", tag)).state ?? null;
    } catch {
      state = null;
    }
  }
  if (state) set({ ...store, friends: [{ tag, name, state }, ...store.friends.filter((f) => f.tag !== tag)] });
  return state;
}

export async function removeFriend(tag: string) {
  set({ ...store, friends: store.friends.filter((f) => f.tag !== tag) });
  if (LIVE) await api("DELETE", tag).catch(() => undefined);
}

export const myTag = () => store.tag;
export const friendOf = (tag: string | null | undefined) => (tag ? store.friends.find((f) => f.tag === tag) : undefined);

export function useFriends() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
  );
}
