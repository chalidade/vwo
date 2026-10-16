// The checks on what the game sends about applications. Kept apart from fair-api.ts so the browser,
// which never runs them, doesn't download zod.
import { z } from "zod";
import { FAIR_APPLICATION_STATUSES } from "./fair-api";

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
  skills: text(600),
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

// --- The conversation on one application, which the company and the applicant both add to.
const message = z.object({
  at: z.number().int().nonnegative(),
  from: z.enum(["company", "seeker"]),
  text: z.string().trim().min(1).max(600),
  /** When the server received it; set by the server, so the order never depends on a device's clock. */
  rt: z.number().int().nonnegative().optional(),
});
const interview = z.object({
  at: z.number().int().nonnegative(),
  mode: z.string().trim().max(60),
  place: z.string().trim().max(300).optional(),
  note: z.string().trim().max(600).optional(),
  reply: z.enum(["hadir", "jadwal-ulang"]).optional(),
  /** When the applicant answered; set by the server. */
  repliedAt: z.number().int().nonnegative().optional(),
  /** When the company sent it (its device's clock), so the applicant's notification keeps its time. */
  sentAt: z.number().int().nonnegative().optional(),
});
/** An invitation to visit the office after a passed interview: when, and the office's address. */
const visit = z.object({
  at: z.number().int().nonnegative(),
  address: z.string().trim().min(1).max(300),
  note: z.string().trim().max(600).optional(),
  reply: z.enum(["hadir", "jadwal-ulang"]).optional(),
  repliedAt: z.number().int().nonnegative().optional(),
  sentAt: z.number().int().nonnegative().optional(),
});
const callLog = z.object({ at: z.number().int().nonnegative(), kind: z.enum(["video", "voice"]), answered: z.boolean(), seconds: z.number().int().min(0).max(86_400) });

export const applicationSharedSchema = z.object({
  messages: z.array(message).max(300).optional(),
  interview: interview.optional(),
  visit: visit.optional(),
  rating: z.number().int().min(1).max(5).optional(),
  ratedAt: z.number().int().nonnegative().optional(),
  feedback: z.string().trim().max(300).optional(),
  calls: z.array(callLog).max(100).optional(),
});
export type ApplicationShared = z.infer<typeof applicationSharedSchema>;

export const applicationSharedPutSchema = z.object({ as: z.enum(["company", "seeker"]), shared: applicationSharedSchema });
