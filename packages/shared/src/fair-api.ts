// What the live game sends to the server about applications, checked on both sides.
import { z } from "zod";

export const FAIR_APPLICATION_STATUSES = ["Terkirim", "Dilihat", "Shortlist", "Diundang interview", "Lolos interview", "Kunjungan kantor", "Diterima", "Belum cocok"] as const;

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
  interview?: { at: number; mode: string; place?: string; note?: string; reply?: "hadir" | "jadwal-ulang"; repliedAt?: number; sentAt?: number };
  visit?: { at: number; address: string; note?: string; reply?: "hadir" | "jadwal-ulang"; repliedAt?: number; sentAt?: number };
  rating?: number;
  ratedAt?: number;
  /** When the company last changed the status; set by the server. */
  statusAt?: number;
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

const msgKey = (m: { at: number; from: string; text: string }) => `${m.at}|${m.from}|${m.text}`;

/**
 * Fold one side's copy into the stored conversation. Each side only adds its own part: the company
 * its messages, the interview and office visit invitations, the rating and call log; the applicant its
 * messages and its answers to the invitations. Messages are never removed, so two devices writing at once both keep theirs.
 */
export function mergeShared(stored: ApplicationShared, incoming: ApplicationShared, as: "company" | "seeker", now = Date.now()): ApplicationShared {
  const out: ApplicationShared = { ...stored };
  const seen = new Set((stored.messages ?? []).map(msgKey));
  const added = (incoming.messages ?? []).filter((m) => m.from === as && !seen.has(msgKey(m)));
  if (added.length) out.messages = [...(stored.messages ?? []), ...added].sort((a, b) => a.at - b.at).slice(-300);
  if (as === "company") {
    if (incoming.interview) out.interview = invitation(stored.interview, incoming.interview);
    if (incoming.visit) out.visit = invitation(stored.visit, incoming.visit);
    if (incoming.rating !== undefined) out.rating = incoming.rating;
    if (incoming.ratedAt !== undefined) out.ratedAt = incoming.ratedAt;
    if (incoming.feedback !== undefined) out.feedback = incoming.feedback;
    if (incoming.calls) {
      const have = new Set((stored.calls ?? []).map((c) => c.at));
      out.calls = [...(stored.calls ?? []), ...incoming.calls.filter((c) => !have.has(c.at))].sort((a, b) => b.at - a.at).slice(0, 100);
    }
  } else {
    if (stored.interview) out.interview = answered(stored.interview, incoming.interview, now);
    if (stored.visit) out.visit = answered(stored.visit, incoming.visit, now);
  }
  return out;
}

type Invitation = { at: number; reply?: "hadir" | "jadwal-ulang"; repliedAt?: number };

/** The company sends (or moves) an invitation: the applicant's answer stays only while the time is the same. */
function invitation<T extends Invitation>(stored: T | undefined, incoming: T): T {
  const same = stored && stored.at === incoming.at;
  return { ...incoming, reply: same ? stored.reply : undefined, repliedAt: same ? stored.repliedAt : undefined };
}

/** The applicant answers the invitation they were sent; an answer to an older time is ignored. */
function answered<T extends Invitation>(stored: T, incoming: Invitation | undefined, now: number): T {
  if (!incoming?.reply || incoming.at !== stored.at) return stored;
  const changed = stored.reply !== incoming.reply;
  return { ...stored, reply: incoming.reply, repliedAt: changed ? now : stored.repliedAt };
}
