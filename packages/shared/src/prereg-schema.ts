// The checks on the pre-registration forms, apart from prereg.ts so the sign-up page doesn't download zod.
import { z } from "zod";
import { EDUCATION_LEVELS } from "./jobfair";
import { cleanWebsite } from "./leads";
import { cleanDay } from "./park";
import { joinSkills, parseSkills } from "./taxonomy";
import { PREREG_AGES, PREREG_FIELDS, PREREG_JOB_TYPES, PREREG_MAX_FIELDS, PREREG_STATUSES } from "./prereg";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optText = (max: number) => z.string().trim().max(max).optional().default("");

/** Only http(s) addresses; a bare "linkedin.com/in/x" gets https://. Empty is fine. */
const link = z
  .string()
  .max(200)
  .optional()
  .transform((v, ctx) => {
    const out = cleanWebsite(v ?? "");
    if (out === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_url" });
      return z.NEVER;
    }
    return out;
  });

/** What a job seeker sends. Every field is checked and capped here; the server stores the output. */
export const preregInput = z.object({
  fullName: text(2, 80),
  /** The Google account they will sign in with. */
  email: z.string().trim().toLowerCase().email().max(120),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\+?[0-9 -]{8,20}$/),
  city: text(2, 60),
  age: z.enum(PREREG_AGES),
  education: z.enum(EDUCATION_LEVELS),
  major: optText(80),
  institution: text(2, 100),
  status: z.enum(PREREG_STATUSES),
  fields: z
    .array(z.string())
    .min(1)
    .max(PREREG_MAX_FIELDS)
    .refine((list) => list.every((f) => PREREG_FIELDS.includes(f)) && new Set(list).size === list.length),
  jobTypes: z
    .array(z.enum(PREREG_JOB_TYPES))
    .min(1)
    .max(PREREG_JOB_TYPES.length)
    .refine((list) => new Set(list).size === list.length),
  /** Comma separated, read like the profile's skills. */
  skills: optText(400).transform((v) => joinSkills(parseSkills(v))),
  experience: optText(1000),
  link,
  consent: z.literal(true),
});

export type PreregInput = z.input<typeof preregInput>;
export type PreregData = z.output<typeof preregInput>;

/** The request around the form: the code when changing an earlier sign-up, the bot checks. */
export const preregRequest = z.object({
  data: preregInput,
  code: z.string().max(40).optional(),
  captcha: z.string().max(4000).optional(),
  /** The signed token the page was given, and the browser's proof of work for it (see antibot.ts). */
  form: z.string().max(300).optional(),
  pow: z.string().max(12).optional(),
  /** Hidden field: people leave it empty, bots fill it in. Any value is taken, so the answer can't tell a bot why it failed. */
  website2: z.string().max(200).optional(),
});

/** Looking up one's own sign-up: both the email and the code, never one alone. */
export const preregLookup = z.object({ email: z.string().trim().toLowerCase().email().max(120), code: z.string().max(40) });

// ---------------------------------------------------------------- the event

const DAY = z
  .string()
  .max(10)
  .optional()
  .transform((v) => cleanDay(v) || "");

/** The organiser's event form. The banner is a JPEG data URL the hub already shrank. */
export const preregEventInput = z.object({
  name: text(3, 80),
  slug: z.string().trim().toLowerCase().max(48).optional(),
  startDate: DAY,
  endDate: DAY,
  location: text(2, 80),
  about: optText(400),
  banner: z
    .string()
    .max(300_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i)
    .nullish(),
  capacity: z.number().int().min(1).max(1_000_000).nullish(),
  open: z.boolean(),
  /** An ISO time; the form closes at it. */
  deadline: z.string().datetime({ offset: true }).nullish(),
});

export type PreregEventInput = z.input<typeof preregEventInput>;
export type PreregEventData = z.output<typeof preregEventInput>;
