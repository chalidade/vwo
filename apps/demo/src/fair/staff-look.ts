import { type Look, lookFor } from "@vwo/ui";

/** Staff (recruiters, desk staff) wear a jacket in their company's colour. Kept apart from the game
 *  so the home page's floor preview does not pull the whole game in. */
export function staffLook(name: string, color: string): Look {
  return { ...lookFor(`staff:${name}`), outfit: "jacket", shirt: color, hat: undefined };
}
