// Walking controls shared by every room: keys and facing. On touch screens people tap where to go.
import { useState } from "react";
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

const HUD_KEY = "vwo:hud";

/**
 * Which HUD panels are open: the place plate and the minimap. On narrow screens they start
 * folded so the room stays visible; the choice is remembered per browser.
 */
export function useHud() {
  const [state, setState] = useState(() => {
    const narrow = typeof matchMedia !== "undefined" && matchMedia("(max-width: 640px)").matches;
    const fallback = { info: !narrow, map: !narrow };
    try {
      const raw = localStorage.getItem(HUD_KEY);
      return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<typeof fallback>) } : fallback;
    } catch {
      return fallback;
    }
  });
  const toggle = (key: "info" | "map") =>
    setState((s) => {
      const next = { ...s, [key]: !s[key] };
      try {
        localStorage.setItem(HUD_KEY, JSON.stringify(next));
      } catch {
        // Not remembered; fine.
      }
      return next;
    });
  return { info: state.info, map: state.map, toggleInfo: () => toggle("info"), toggleMap: () => toggle("map") };
}
