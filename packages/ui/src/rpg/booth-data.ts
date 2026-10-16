// What a company can put in its booth, as plain data: the start-up code and the price list need
// it without the drawings in BoothDecor.

export type AccessorySlot = "floor" | "corner" | "air" | "wall" | "gate";

export interface BoothAccessory {
  id: string;
  name: string;
  emoji: string;
  slot: AccessorySlot;
}

export const BOOTH_ACCESSORIES: BoothAccessory[] = [
  { id: "plant", name: "Tanaman pot", emoji: "🪴", slot: "corner" },
  { id: "flag", name: "Umbul-umbul", emoji: "🚩", slot: "floor" },
  { id: "standee", name: "Maskot", emoji: "🐣", slot: "floor" },
  { id: "giveaway", name: "Rak merchandise", emoji: "🎁", slot: "floor" },
  { id: "coffee", name: "Coffee cart", emoji: "☕", slot: "floor" },
  { id: "beanbag", name: "Bean bag", emoji: "🛋️", slot: "floor" },
  { id: "tv", name: "TV video profil", emoji: "📺", slot: "floor" },
  { id: "photobooth", name: "Photo booth", emoji: "📸", slot: "floor" },
  { id: "balloons", name: "Balon", emoji: "🎈", slot: "air" },
  { id: "neon", name: 'Neon "We\'re hiring"', emoji: "💡", slot: "wall" },
  { id: "gapura", name: "Gapura", emoji: "🎋", slot: "gate" },
];

/** At most this many floor items fit in a booth. */
export const FLOOR_SLOTS = 4;
