// Realtime protocol between the world client and the realtime server (Socket.IO).
// One Socket.IO room per (venue, floor). Positions live only in server memory/Redis.

/** Sprites have four directions, matching docs/design/references. */
export type Facing = "front" | "back" | "left" | "right";

export interface AvatarState {
  memberId: string;
  visitId: string;
  displayName: string;
  memberType: "host" | "app_user" | "companion";
  floorId: string;
  x: number;
  y: number;
  facing: Facing;
  /** Member this NPC follows, for companions. */
  followsMemberId?: string | null;
  seatId?: string | null;
  /** Has the blue verified check. */
  verified?: boolean;
}

export interface ClientToServerEvents {
  "world:join": (
    payload: { venueSlug: string; floorId?: string; visitId?: string; memberId?: string; displayName: string },
    ack: (res: JoinResult) => void,
  ) => void;
  "avatar:move": (payload: { x: number; y: number; facing?: Facing }) => void;
  "avatar:emote": (payload: { emote: Emote }) => void;
  "seat:claim": (payload: { assignments: { memberId: string; seatId: string }[] }, ack: (res: AckResult) => void) => void;
  "seat:release": (payload: { memberId: string }, ack: (res: AckResult) => void) => void;
}

export interface ServerToClientEvents {
  "world:snapshot": (payload: { floorId: string; avatars: AvatarState[]; occupiedSeatIds: string[] }) => void;
  "avatar:joined": (payload: AvatarState) => void;
  "avatar:moved": (payload: { memberId: string; x: number; y: number; facing: Facing }) => void;
  "avatar:left": (payload: { memberId: string }) => void;
  "avatar:emoted": (payload: { memberId: string; emote: Emote }) => void;
  "seat:updated": (payload: { seatId: string; memberId: string | null }) => void;
  "venue:counts": (payload: { peopleInside: number; seatsFree: number; seatsTotal: number }) => void;
}

export type Emote = "wave" | "cheers" | "laugh" | "heart";
export const EMOTES: readonly Emote[] = ["wave", "cheers", "laugh", "heart"];

export type AckResult = { ok: true } | { ok: false; error: "seat_taken" | "not_allowed" | "invalid" };
export type JoinResult =
  | { ok: true; floorId: string; self: AvatarState | null }
  | { ok: false; error: "venue_not_found" | "invalid" };

/** Direction a sprite should face after moving by (dx, dy). Screen y grows downward. */
export function facingFor(dx: number, dy: number, previous: Facing = "front"): Facing {
  if (dx === 0 && dy === 0) return previous;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "front" : "back";
}

/** Max position updates per second accepted from one client. */
export const MOVE_RATE_LIMIT_HZ = 15;
