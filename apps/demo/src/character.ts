// The player's character, remembered per account. Kept apart from the creator so the start-up
// code that syncs it doesn't pull in the drawn figures.
import type { Look } from "@vwo/ui";
import { accountKey } from "./account";

const STORE_KEY = "vwo:character";
const storeKey = () => accountKey(STORE_KEY);

export interface Character {
  name: string;
  look: Look;
}

export function loadCharacter(): Character | null {
  try {
    const raw = localStorage.getItem(storeKey());
    return raw ? (JSON.parse(raw) as Character) : null;
  } catch {
    return null;
  }
}

export function saveCharacter(c: Character) {
  try {
    localStorage.setItem(storeKey(), JSON.stringify(c));
  } catch {
    // Private mode or blocked storage: the character just isn't remembered.
  }
}
