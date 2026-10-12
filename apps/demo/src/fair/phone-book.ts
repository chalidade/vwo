// Who the park's phone box can call: friends only (not people who only asked, or were asked), the
// ones at the fair right now first. Someone not online is listed but can't be rung.
import type { FriendOnline } from "./Friends";
import type { Friend } from "./friends";

export interface PhoneEntry {
  tag: string;
  name: string;
  /** At the fair now: who to ring, and where they are. */
  online: FriendOnline | null;
}

export function phoneBook(friends: readonly Friend[], online: ReadonlyMap<string, FriendOnline>): PhoneEntry[] {
  return friends
    .filter((f) => f.state === "friend")
    .map((f) => ({ tag: f.tag, name: f.name, online: online.get(f.tag) ?? null }))
    .sort((a, b) => Number(!!b.online) - Number(!!a.online) || a.name.localeCompare(b.name, "id"));
}
