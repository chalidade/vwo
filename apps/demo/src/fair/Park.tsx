import { type ParkBuilding, type ParkNpc, parkBuildingDate } from "@vwo/shared";
import { type Look, lookFor } from "@vwo/ui";

/** How one of the park's people looks, from what they are doing: running gear, the vendor's straw
 *  hat, the guard's uniform, the neighbourhood watch in peci and batik. */
export function parkNpcLook(n: ParkNpc, night: boolean): Look {
  const base = { ...lookFor(n.id), backpack: undefined, prop: undefined, cane: false };
  switch (n.activity) {
    case "jog":
      return { ...base, outfit: "tee", shorts: true, shoes: "#f97316", hat: night ? undefined : "cap", glasses: false };
    case "play":
      return { ...base, outfit: "tee", shorts: true, hat: undefined, mustache: false, glasses: false };
    case "vendor":
      return { ...base, outfit: "kemeja", shirt: "#f8fafc", hat: "straw", mustache: true };
    case "patrol":
      return { ...base, outfit: "kemeja", shirt: "#1e3a8a", pants: "#1f2937", hat: "cap", hatColor: "#1e3a8a" };
    case "chat":
      return night ? { ...base, outfit: "batik", hat: "peci", hatColor: "#111827" } : base;
    case "feed":
      return { ...base, hair: "#e5e7eb", style: "bun", outfit: "dress", hat: undefined, glasses: true };
    default:
      return base;
  }
}

/** What a "coming soon" building in the park says when someone walks up to it. It cannot be entered yet. */
export function ParkCard({ building: b }: { building: ParkBuilding }) {
  return (
    <div className="rpg-box park-card" role="status" onPointerDown={(e) => e.stopPropagation()}>
      <span className="park-card-tag">🚧 Coming soon</span>
      <b className="park-card-name">{b.name}</b>
      {parkBuildingDate(b) && <span className="park-card-date">📅 {parkBuildingDate(b)}</span>}
      {b.about && <p className="park-card-about">{b.about}</p>}
      <span className="park-card-note">Gedung ini masih dibangun, belum bisa dimasuki. Nantikan acaranya!</span>
    </div>
  );
}
