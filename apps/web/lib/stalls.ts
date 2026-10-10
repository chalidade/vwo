import "server-only";
import { addFairStateLocked, type Payment } from "@vwo/db";
import { DEMO_JOB_FAIR, type FoodStall, freeStallSlotsOf, makeStall, type StallInput } from "@vwo/shared";
import { z } from "zod";
import { db } from "./db";

/** The food court a business rents in. */
export const FOOD_COURT = DEMO_JOB_FAIR.rooms.find((r) => r.kind === "foodcourt" && r.stalls)!.id;

/** What the renter fills in; the server builds the stall from it. */
export const stallInput = z.object({
  name: z.string().trim().min(1).max(40),
  vendor: z.string().trim().max(30).optional(),
  promo: z.string().trim().max(80).optional(),
  emoji: z.string().trim().max(8).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  deal: z.object({ title: z.string().trim().max(60), worth: z.string().trim().max(20), price: z.number().int().min(1).max(200) }).nullish(),
});

/** A paid rental, stored as its own `stall:<payment id>` document. */
type RentedDoc = { roomId: string; stall: FoodStall; by: string; paymentId: string };

type Row = { key: string; data: unknown };

/** The stalls standing in a food court now: the organiser's list (or the published one) and paid rentals not taken out. */
export function stallsIn(rows: Row[], roomId = FOOD_COURT): FoodStall[] {
  const org = (rows.find((r) => r.key === "org")?.data ?? {}) as { stalls?: Record<string, FoodStall[]>; removedStalls?: string[] };
  const list = org.stalls?.[roomId] ?? DEMO_JOB_FAIR.rooms.find((r) => r.id === roomId)?.stalls ?? [];
  const out = [...list];
  for (const r of rows) {
    if (!r.key.startsWith("stall:")) continue;
    const d = r.data as RentedDoc;
    if (d.roomId !== roomId || org.removedStalls?.includes(d.stall.id) || out.some((st) => st.id === d.stall.id)) continue;
    out.push(d.stall);
  }
  return out;
}

/**
 * A rental is paid: open the stall in the slot the business picked, or the first free one if
 * someone else took it meanwhile. Under a lock, so two payments never get the same slot.
 * Returns null when the food court is full (the organiser refunds it).
 */
export async function placeRentedStall(p: Payment) {
  const meta = p.meta as { roomId?: string; slot?: number; input?: StallInput };
  const roomId = meta.roomId ?? FOOD_COURT;
  const placed = await addFairStateLocked(db, `stalls:${roomId}`, p.userId, (rows) => {
    if (rows.some((r) => r.key === `stall:${p.id}`)) return null;
    const free = freeStallSlotsOf(stallsIn(rows, roomId));
    const slot = free.includes(meta.slot ?? -1) ? meta.slot! : free[0];
    if (slot === undefined || !meta.input) return null;
    const stall = makeStall(`rent-${p.id.slice(0, 8)}`, slot, meta.input);
    if (!stall) return null;
    const doc: RentedDoc = { roomId, stall, by: p.userId, paymentId: p.id };
    return { key: `stall:${p.id}`, data: doc };
  });
  if (!placed) console.warn("paid stall rental not placed", p.id);
  return placed;
}

/** Rented stalls for the state feed; who paid only for the organiser. */
export const rentedOut = (data: unknown, admin: boolean) => {
  const d = data as RentedDoc;
  return admin ? d : { roomId: d.roomId, stall: d.stall };
};
