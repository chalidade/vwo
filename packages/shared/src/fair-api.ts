// What the live game sends to the server about applications, checked on both sides.
import { z } from "zod";

export const FAIR_APPLICATION_STATUSES = ["Terkirim", "Dilihat", "Shortlist", "Diundang interview", "Diterima", "Belum cocok"] as const;

const key = z.string().regex(/^[\w-]{1,80}$/);
const text = (max: number) => z.string().trim().max(max).optional();

export const fairApplicationSchema = z.object({
  boothId: key,
  jobId: key,
  company: z.string().trim().min(1).max(120),
  jobTitle: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120),
  phone: text(30),
  cvUrl: z
    .string()
    .trim()
    .max(300)
    .refine((u) => u === "" || /^https?:\/\//i.test(u), "must be an http(s) link")
    .optional(),
  message: text(1000),
  headline: text(200),
  education: text(200),
  skills: text(300),
  city: text(80),
  /** A small profile photo the game already shrank to 160 px. */
  photo: z
    .string()
    .max(100_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i)
    .optional(),
  psych: z.number().int().min(0).max(100).optional(),
  verified: z.boolean().optional(),
});
export type FairApplicationInput = z.infer<typeof fairApplicationSchema>;

export const fairApplicationStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(FAIR_APPLICATION_STATUSES),
});

/** An application as the server sends it back to the game. */
export interface FairApplicationOut extends FairApplicationInput {
  id: string;
  /** The applicant's account id, so the company can call them. */
  seeker: string;
  status: (typeof FAIR_APPLICATION_STATUSES)[number];
  at: number;
  updatedAt: number;
}
