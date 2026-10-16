// The checks on booth and stall request forms, apart from leads.ts so the browser doesn't download zod.
import { z } from "zod";
import { STALL_SLOTS } from "./jobfair";
import { cleanWebsite } from "./leads";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 -]{8,20}$/);
const note = z.string().trim().max(500).optional();
/** Hidden field: people leave it empty, bots fill it in. */
const honeypot = z.string().max(0).optional();

const website = z
  .string()
  .max(120)
  .optional()
  .transform((v, ctx) => {
    const out = cleanWebsite(v ?? "");
    if (out === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_url" });
      return z.NEVER;
    }
    return out;
  });

/** A company asking for a booth. `want` is the stand they tapped in the hall, if any. */
export const boothLeadInput = z.object({
  company: text(2, 60),
  industry: text(2, 60),
  city: text(2, 60),
  website,
  contactName: text(2, 60),
  contactRole: text(2, 60),
  email: z.string().trim().email().max(120),
  phone,
  want: z.object({ floor: z.number().int().min(0).max(20), x: z.number().finite().min(-1000).max(1000), y: z.number().finite().min(-1000).max(1000) }).nullish(),
  note,
  website2: honeypot,
});

/** A food business asking for a food court stall. `slot` is the empty stall they tapped, if any. */
export const stallLeadInput = z.object({
  business: text(2, 60),
  sells: text(2, 120),
  contactName: text(2, 60),
  email: z.string().trim().email().max(120),
  phone,
  slot: z
    .number()
    .int()
    .min(0)
    .max(STALL_SLOTS.length - 1)
    .nullish(),
  note,
  website2: honeypot,
});

export type BoothLeadInput = z.input<typeof boothLeadInput>;
export type StallLeadInput = z.input<typeof stallLeadInput>;
export type BoothLeadData = z.output<typeof boothLeadInput>;
export type StallLeadData = z.output<typeof stallLeadInput>;

/** What the organiser may change by hand: the status and their notes. */
export const leadPatch = z.object({ status: z.enum(["new", "contacted", "done", "rejected"]).optional(), orgNote: z.string().trim().max(1000).optional() });
export type LeadPatch = z.infer<typeof leadPatch>;
