import "server-only";
import { readFairState } from "@vwo/db";
import { timingSafeEqual } from "node:crypto";
import { db } from "./db";

/**
 * The portal PIN the organiser set for a booth (or that its booking created). Booths without one
 * cannot be claimed: the demo's built-in default PINs are guessable, so they never count here.
 */
export async function boothPin(boothKey: string) {
  const rows = await readFairState(db);
  for (const r of rows) {
    const data = r.data as { pins?: Record<string, unknown>; pin?: unknown; booth?: { id?: unknown } };
    if (r.key === "org" && typeof data.pins?.[boothKey] === "string") return data.pins[boothKey] as string;
    if (r.key === `booking:${boothKey}` && typeof data.pin === "string") return data.pin;
  }
  return null;
}

export function samePin(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
