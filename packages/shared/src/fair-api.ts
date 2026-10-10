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

/** Filled in below; declared here so the response type can carry the conversation. */
interface ApplicationSharedFields {
  messages?: { at: number; from: "company" | "seeker"; text: string }[];
  interview?: { at: number; mode: string; place?: string; note?: string; reply?: "hadir" | "jadwal-ulang"; repliedAt?: number };
  rating?: number;
  feedback?: string;
  calls?: { at: number; kind: "video" | "voice"; answered: boolean; seconds: number }[];
}

export const fairApplicationStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(FAIR_APPLICATION_STATUSES),
});

/** An application as the server sends it back to the game. */
export interface FairApplicationOut extends FairApplicationInput, ApplicationSharedFields {
  id: string;
  /** The applicant's account id, so the company can call them. */
  seeker: string;
  status: (typeof FAIR_APPLICATION_STATUSES)[number];
  at: number;
  updatedAt: number;
  /** The company's private notes; only in the booth's own list. */
  notes?: string;
}

// --- The conversation on one application, which the company and the applicant both add to.
const message = z.object({ at: z.number().int().nonnegative(), from: z.enum(["company", "seeker"]), text: z.string().trim().min(1).max(600) });
const interview = z.object({
  at: z.number().int().nonnegative(),
  mode: z.string().trim().max(60),
  place: z.string().trim().max(300).optional(),
  note: z.string().trim().max(600).optional(),
  reply: z.enum(["hadir", "jadwal-ulang"]).optional(),
  /** When the applicant answered; set by the server. */
  repliedAt: z.number().int().nonnegative().optional(),
});
const callLog = z.object({ at: z.number().int().nonnegative(), kind: z.enum(["video", "voice"]), answered: z.boolean(), seconds: z.number().int().min(0).max(86_400) });

export const applicationSharedSchema = z.object({
  messages: z.array(message).max(300).optional(),
  interview: interview.optional(),
  rating: z.number().int().min(1).max(5).optional(),
  feedback: z.string().trim().max(300).optional(),
  calls: z.array(callLog).max(100).optional(),
});
export type ApplicationShared = z.infer<typeof applicationSharedSchema>;

export const applicationSharedPutSchema = z.object({ as: z.enum(["company", "seeker"]), shared: applicationSharedSchema });

const msgKey = (m: { at: number; from: string; text: string }) => `${m.at}|${m.from}|${m.text}`;

/**
 * Fold one side's copy into the stored conversation. Each side only adds its own part: the company
 * its messages, the interview, the rating and call log; the applicant its messages and the answer to
 * the invitation. Messages are never removed, so two devices writing at once both keep theirs.
 */
export function mergeShared(stored: ApplicationShared, incoming: ApplicationShared, as: "company" | "seeker", now = Date.now()): ApplicationShared {
  const out: ApplicationShared = { ...stored };
  const seen = new Set((stored.messages ?? []).map(msgKey));
  const added = (incoming.messages ?? []).filter((m) => m.from === as && !seen.has(msgKey(m)));
  if (added.length) out.messages = [...(stored.messages ?? []), ...added].sort((a, b) => a.at - b.at).slice(-300);
  if (as === "company") {
    if (incoming.interview) {
      const same = stored.interview && stored.interview.at === incoming.interview.at;
      out.interview = { ...incoming.interview, reply: same ? stored.interview!.reply : undefined, repliedAt: same ? stored.interview!.repliedAt : undefined };
    }
    if (incoming.rating !== undefined) out.rating = incoming.rating;
    if (incoming.feedback !== undefined) out.feedback = incoming.feedback;
    if (incoming.calls) {
      const have = new Set((stored.calls ?? []).map((c) => c.at));
      out.calls = [...(stored.calls ?? []), ...incoming.calls.filter((c) => !have.has(c.at))].sort((a, b) => b.at - a.at).slice(0, 100);
    }
  } else if (stored.interview && incoming.interview?.reply && incoming.interview.at === stored.interview.at) {
    const changed = stored.interview.reply !== incoming.interview.reply;
    out.interview = { ...stored.interview, reply: incoming.interview.reply, repliedAt: changed ? now : stored.interview.repliedAt };
  }
  return out;
}
