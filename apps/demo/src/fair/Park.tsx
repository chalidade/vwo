import type { ParkBuilding } from "@vwo/shared";

/** What a "coming soon" building in the park says when someone walks up to it. It cannot be entered yet. */
export function ParkCard({ building: b }: { building: ParkBuilding }) {
  return (
    <div className="rpg-box park-card" role="status" onPointerDown={(e) => e.stopPropagation()}>
      <span className="park-card-tag">🚧 Coming soon</span>
      <b className="park-card-name">{b.name}</b>
      {b.date && <span className="park-card-date">📅 {b.date}</span>}
      {b.about && <p className="park-card-about">{b.about}</p>}
      <span className="park-card-note">Gedung ini masih dibangun, belum bisa dimasuki. Nantikan acaranya!</span>
    </div>
  );
}
