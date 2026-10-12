import { fairFloorIndex, hasStand, infoDeskOn, parkPlots } from "@vwo/shared";
import {
  CafeScene,
  anomalyExtras,
  boothExtras,
  coinStandExtras,
  emptyBoothExtras,
  foodStallExtras,
  infoDeskExtras,
  liftExtras,
  lookFor,
  parkDoorExtras,
  parkExtras,
  promoterExtras,
  psikotesExtras,
  seminarStageExtras,
  sponsorExtras,
} from "@vwo/ui";
import { staffLook } from "./staff-look";
import { levelOf } from "./content";
import { fair } from "../useFair";
import { startAnomalies, useAnomaly } from "../anomaly-sync";
import { useEffect } from "react";

/** Which part of a booth floor to show: all of it, or one half (a hall is twice as wide as tall rooms). */
export type FloorArea = "all" | "left" | "right";

/** One floor of the job fair as everyone on it sees it, without a player: the organiser's live view
 *  and the home page preview. The caller re-renders it (useFair) so people keep walking. Rooms are
 *  always shown whole; `area` picks a half of a booth floor. */
export function FloorScene({ floorId, className, area = "all" }: { floorId: string; className?: string; area?: FloorArea }) {
  const stop = fair.stopOf(floorId);
  const floor = fair.floor(stop.floorId);
  const room = fair.roomOf(floor.id);
  const park = floor.id === fair.parkId;
  const hall = park ? -1 : fairFloorIndex(floor.id);
  const half = floor.width / 2;
  const fitArea = room || park || area === "all" ? undefined : { x: area === "left" ? 0 : half, width: half };
  const anomaly = useAnomaly();
  useEffect(() => startAnomalies(), []);
  return (
    <CafeScene
      className={className}
      floor={floor}
      fitArea={fitArea}
      floorName={(id) => fair.stopOf(id).name}
      hallTitle={room || park ? undefined : fair.hallBanner(hall).title}
      hallSubtitle={room || park ? undefined : fair.hallBanner(hall).subtitle}
      hallBanner={!room && !park}
      occupiedSeatIds={fair.occupiedSeats()}
      avatars={[...fair.visitors.values()]}
      lookOf={(a) => lookFor(`${a.displayName}:${a.memberId}`)}
      npcs={fair.staff.map((s) => ({
        id: s.id,
        name: s.name,
        floorId: s.floorId,
        x: s.x,
        y: s.y,
        facing: s.facing,
        look: staffLook(s.name, (s.boothId && fair.booth(s.boothId)?.color) || fair.fair.promoters.find((p) => s.id.endsWith(p.id))?.color || "#1e3a8a"),
      }))}
      bubbles={Object.fromEntries([...fair.bubbles].map(([id, b]) => [id, b.text]))}
      extras={
        park
          ? parkExtras({ eventName: fair.fair.name, plots: parkPlots(fair.shownParkBuildings()) })
          : [
              ...(anomaly?.floorId === floor.id ? anomalyExtras({ ...anomaly, claimed: anomaly.claimed?.coins }) : []),
              ...(floor.id === fair.lobbyId ? parkDoorExtras(floor) : []),
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
                    ...fair.fair.booths
                      .filter((b) => b.floor === hall && hasStand(b))
                      .flatMap((b) => boothExtras(b, { rating: { ...fair.companyRating(b.id), level: levelOf(fair.companyXp(b.id)).level } })),
                    // Free slots show as empty stands, so the organiser sees what is still open.
                    ...fair
                      .freeSlots()
                      .filter((sl) => sl.floor === hall)
                      .flatMap((sl) => emptyBoothExtras(sl)),
                    ...fair.fair.sponsors.filter((sp) => sp.floor === hall).map((sp) => sponsorExtras(sp)),
                    ...(fair.fair.coinStand.floor === hall ? coinStandExtras(fair.fair.coinStand) : []),
                  ]),
            ]
      }
      hallSponsors={fair.fair.sponsors}
    />
  );
}
