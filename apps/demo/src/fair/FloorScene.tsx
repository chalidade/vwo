import { fairFloorIndex, infoDeskOn } from "@vwo/shared";
import { CafeScene, boothExtras, coinStandExtras, foodStallExtras, infoDeskExtras, liftExtras, lookFor, promoterExtras, psikotesExtras, seminarStageExtras, sponsorExtras } from "@vwo/ui";
import { staffLook } from "../JobFair";
import { levelOf } from "./content";
import { fair } from "../useFair";

/** One floor of the job fair as everyone on it sees it, without a player: the organiser's live view
 *  and the home page preview. The caller re-renders it (useFair) so people keep walking. */
export function FloorScene({ floorId, className }: { floorId: string; className?: string }) {
  const stop = fair.stopOf(floorId);
  const floor = fair.floor(stop.floorId);
  const room = fair.roomOf(floor.id);
  const hall = fairFloorIndex(floor.id);
  return (
    <CafeScene
      className={className}
      floor={floor}
      floorName={(id) => fair.stopOf(id).name}
      hallTitle={room ? undefined : fair.hallBanner(hall).title}
      hallSubtitle={room ? undefined : fair.hallBanner(hall).subtitle}
      hallBanner={!room}
      occupiedSeatIds={fair.occupiedSeats()}
      avatars={[...fair.visitors.values()]}
      lookOf={(a) => lookFor(`${a.displayName}:${a.memberId}`)}
      npcs={fair.staff.map((s) => ({ id: s.id, name: s.name, floorId: s.floorId, x: s.x, y: s.y, facing: s.facing, look: staffLook(s.name, (s.boothId && fair.booth(s.boothId)?.color) || fair.fair.promoters.find((p) => s.id.endsWith(p.id))?.color || "#1e3a8a") }))}
      bubbles={Object.fromEntries([...fair.bubbles].map(([id, b]) => [id, b.text]))}
      extras={[
        ...liftExtras(stop.name, fair.stops),
        ...infoDeskExtras(infoDeskOn(fair.fair, floor.id)),
        ...fair.fair.promoters.filter((p) => p.level === stop.level && !p.walks).flatMap((p) => promoterExtras(p)),
        ...(room
          ? room.kind === "foodcourt"
            ? foodStallExtras(room)
            : room.kind === "psikotes"
              ? psikotesExtras(room)
              : seminarStageExtras(room, null)
          : [
              ...fair.fair.booths.filter((b) => b.floor === hall).flatMap((b) => boothExtras(b, { rating: { ...fair.companyRating(b.id), level: levelOf(fair.companyXp(b.id)).level } })),
              ...fair.fair.sponsors.filter((sp) => sp.floor === hall).map((sp) => sponsorExtras(sp)),
              ...(fair.fair.coinStand.floor === hall ? coinStandExtras(fair.fair.coinStand) : []),
            ]),
      ]}
      hallSponsors={fair.fair.sponsors}
    />
  );
}
