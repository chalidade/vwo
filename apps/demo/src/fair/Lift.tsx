import type { FairStop } from "@vwo/shared";
import { Modal } from "./Modal";

/** The lift's floor buttons: every floor, what is on it, and what a premium floor costs. */
export function LiftPanel({
  stops,
  here,
  atLift,
  ticket,
  onPick,
  onClose,
}: {
  stops: FairStop[];
  here: string;
  /** Standing at the lift rides straight away; elsewhere you walk to it first. */
  atLift: boolean;
  /** Coins still owed to enter a floor, or null when free or already paid. */
  ticket: (floorId: string) => number | null;
  onPick: (floorId: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="🛗 Lift · pilih lantai" onClose={onClose} className="fx-lift">
      <p className="sp-summary">{atLift ? "Mau ke lantai berapa?" : "Pilih lantai, nanti kamu diantar ke lift di pojok kanan bawah."}</p>
      <div className="fx-floors">
        {[...stops].reverse().map((st) => {
          const owe = ticket(st.floorId);
          const isHere = st.floorId === here;
          return (
            <button key={st.floorId} type="button" className="fx-floor" data-here={isHere ? "" : undefined} disabled={isHere} onClick={() => onPick(st.floorId)}>
              <b className="fx-floor-n">{st.level + 1}</b>
              <span className="fx-floor-label">
                {st.emoji} {st.label}
              </span>
              <span className="fx-floor-tag">{isHere ? "Kamu di sini" : owe ? `${owe} 🪙` : st.roomId ? "Masuk" : ""}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
