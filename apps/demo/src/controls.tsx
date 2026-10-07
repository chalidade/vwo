// Walking controls shared by every room: keys and facing. On touch screens people tap where to go.
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
