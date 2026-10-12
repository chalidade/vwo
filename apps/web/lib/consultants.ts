import "server-only";
import { type Payment, placePaidConsultant } from "@vwo/db";
import { CONSULT_DESKS, CONSULT_LIMITS as L } from "@vwo/shared";
import { z } from "zod";
import { db } from "./db";

/** A consultant's public profile, as they type it. */
export const consultProfile = z.object({
  name: z.string().trim().min(2).max(L.name),
  role: z.string().trim().min(2).max(L.role),
  org: z
    .string()
    .trim()
    .max(L.org)
    .optional()
    .transform((s) => s || undefined),
  topics: z.array(z.string().trim().min(2).max(L.topic)).min(1).max(L.topics),
  bio: z
    .string()
    .trim()
    .max(L.bio)
    .optional()
    .transform((s) => s || undefined),
  emoji: z.string().trim().min(1).max(8),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});

/** How to reach them: for the organiser only. */
export const consultContact = z.object({
  email: z.string().trim().toLowerCase().email().max(L.email),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{8,20}$/),
});

export const consultDesk = z
  .number()
  .int()
  .min(0)
  .max(CONSULT_DESKS - 1);

/** A paid consultant slot: seat the buyer (see placePaidConsultant). */
export const placePaidSlot = (p: Payment) => placePaidConsultant(db, p);
