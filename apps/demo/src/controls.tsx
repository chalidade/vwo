// Walking controls shared by every room: keys, facing, and the on-screen pad for touch screens.
import type { MutableRefObject } from "react";
import type { Facing } from "@vwo/shared";

export const WALK = 3.2; // tiles per second
export const RUN = 5.2;

export const KEY_DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

export function facingOf(dx: number, dy: number, prev: Facing): Facing {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return prev;
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? "back" : "front";
  return dx < 0 ? "left" : "right";
}

/** Arrow pad and an A button, shown on touch screens. */
export function TouchPad({ keys, onA }: { keys: MutableRefObject<Set<string>>; onA: () => void }) {
  const press = (code: string, on: boolean) => (on ? keys.current.add(code) : keys.current.delete(code));
  return (
    <div className="pad" onPointerDown={(e) => e.stopPropagation()}>
      {(
        [
          ["KeyW", "▲", "up"],
          ["KeyA", "◀", "left"],
          ["KeyS", "▼", "down"],
          ["KeyD", "▶", "right"],
        ] as const
      ).map(([code, label, area]) => (
        <button
          key={code}
          type="button"
          style={{ gridArea: area }}
          onPointerDown={() => press(code, true)}
          onPointerUp={() => press(code, false)}
          onPointerLeave={() => press(code, false)}
          onPointerCancel={() => press(code, false)}
        >
          {label}
        </button>
      ))}
      <button type="button" className="pad-a" style={{ gridArea: "a" }} onClick={onA}>
        A
      </button>
    </div>
  );
}
