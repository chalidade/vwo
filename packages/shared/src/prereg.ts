// Job seeker pre-registration per event. Before an event opens, a job seeker fills in the form at
// jobfair.co.id/daftar/<slug> and gets a short code to keep. When the site opens they sign in with the
// Google account of the email they gave; the sign-up is then linked to that account and fills the empty
// parts of its profile, so nobody registers again on launch day. The form, the code and the mapping
// onto the profile live here; the tables and the locking are in packages/db prereg.ts.
import { z } from "zod";
import { EDUCATION_LEVELS } from "./jobfair";
import { cleanWebsite } from "./leads";
import { cleanDateRange, cleanDay, formatDateRange } from "./park";
import { POSITION_GROUPS } from "./job-lists";
import { joinSkills, parseSkills } from "./taxonomy";
import { slugify } from "./slug";

// ---------------------------------------------------------------- the code

/** No 0/O, 1/I/L: a code read off a screenshot or over the phone is typed back right. */
export const PREREG_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LEN = 8;

/**
 * A new code, "JF-7K3M-Q9TX": 8 characters from 31, about 40 bits, drawn from `random` (the server
 * passes node:crypto randomBytes). Bytes that would bias the draw are thrown away.
 */
export function newPreregCode(random: (n: number) => Uint8Array): string {
  const limit = 256 - (256 % PREREG_ALPHABET.length);
  let out = "";
  while (out.length < CODE_LEN) {
    for (const b of random(16)) {
      if (b >= limit) continue;
      out += PREREG_ALPHABET[b % PREREG_ALPHABET.length];
      if (out.length === CODE_LEN) break;
    }
  }
  return `JF-${out.slice(0, 4)}-${out.slice(4)}`;
}

/** A typed code in its stored form ("jf 7k3m q9tx" → "JF-7K3M-Q9TX"), or null when it can't be one. */
export function normalizePreregCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 40) return null;
  let s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length === CODE_LEN + 2 && s.startsWith("JF")) s = s.slice(2);
  if (s.length !== CODE_LEN || [...s].some((c) => !PREREG_ALPHABET.includes(c))) return null;
  return `JF-${s.slice(0, 4)}-${s.slice(4)}`;
}

// ---------------------------------------------------------------- the form

export const PREREG_STATUSES = ["Fresh graduate", "Mahasiswa / pelajar", "Sudah bekerja", "Belum bekerja"] as const;
export const PREREG_AGES = ["Di bawah 18", "18–22", "23–27", "28–35", "36–45", "Di atas 45"] as const;
/** The vacancy types companies post (job-lists.ts). */
export const PREREG_JOB_TYPES = ["Full-time", "Kontrak", "Magang", "Part-time"] as const;
/** Job fields to pick from: the job functions vacancies are grouped by, so interests match vacancies. */
export const PREREG_FIELDS: readonly string[] = POSITION_GROUPS.map(([g]) => g);
export const PREREG_MAX_FIELDS = 5;

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

/** Gmail addresses are Google accounts for sure; any other address only if it was made into one. */
export const isGmail = (email: string) => /@(gmail|googlemail)\.com$/i.test(email.trim());

// ---------------------------------------------------------------- onto the profile

/** The game's job seeker profile fields a sign-up fills (apps/demo profile.ts SeekerProfile). */
export interface PreregProfile {
  name: string;
  headline: string;
  email: string;
  phone: string;
  city: string;
  education: string;
  campus: string;
  skills: string;
  cvUrl: string;
}

/** A sign-up as the profile spells it: "S1 Teknik Informatika", "Fresh graduate Teknik Informatika". */
export function profileFromPrereg(d: PreregData): PreregProfile {
  const major = d.major.trim();
  return {
    name: d.fullName,
    headline: major ? `${d.status} ${major}` : d.status,
    email: d.email,
    phone: d.whatsapp,
    city: d.city,
    education: major ? `${d.education} ${major}` : d.education,
    campus: d.institution,
    skills: d.skills,
    cvUrl: d.link,
  };
}

const empty = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** The profile with only its empty fields filled from `from`; what it already has is never changed. */
export function fillEmptyProfile(profile: Record<string, unknown> | null | undefined, from: Partial<PreregProfile>) {
  const out: Record<string, unknown> = { ...(profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {}) };
  const filled: string[] = [];
  for (const [k, v] of Object.entries(from)) {
    if (empty(v) || !empty(out[k])) continue;
    out[k] = v;
    filled.push(k);
  }
  return { profile: out, filled };
}

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

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;

/** The address part of jobfair.co.id/daftar/<slug>: the typed one if usable, else made from the name. */
export function preregSlug(name: string, typed?: string) {
  const t = (typed ?? "").trim().toLowerCase();
  if (SLUG.test(t)) return t;
  const s = slugify(name).slice(0, 48).replace(/-+$/, "");
  return SLUG.test(s) ? s : `event-${s}`.slice(0, 48).replace(/-+$/, "");
}

export const isPreregSlug = (s: string) => SLUG.test(s);

/** Dates as the event form saves them: a usable range or none. */
export function preregDates(start: string, end: string) {
  const r = cleanDateRange(start, end);
  return { startDate: r?.startDate ?? null, endDate: r?.endDate ?? null };
}

/** What an event's public page and the landing know of it. Never anyone's sign-up. */
export interface PublicPreregEvent {
  slug: string;
  name: string;
  date: string;
  location: string;
  about: string;
  banner: string | null;
  state: PreregState;
}

export type PreregState = "open" | "closed" | "deadline" | "full";

/** Whether the form takes sign-ups now: open by the organiser, before the deadline, with room left. */
export function preregState(e: { open: boolean; deadline: Date | number | null; capacity: number | null }, count: number, now = Date.now()): PreregState {
  if (!e.open) return "closed";
  if (e.deadline !== null && +e.deadline <= now) return "deadline";
  if (e.capacity !== null && count >= e.capacity) return "full";
  return "open";
}

export const preregDate = (e: { startDate: string | null; endDate: string | null }) => (e.startDate ? formatDateRange(e.startDate, e.endDate ?? undefined) : "");

// ---------------------------------------------------------------- export

/** One CSV cell: quoted, and a leading = + - @ (or tab, CR) defused so a spreadsheet won't run it. */
export function csvCell(v: unknown) {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export const PREREG_CSV_HEADER = [
  "Kode",
  "Nama",
  "Email",
  "WhatsApp",
  "Domisili",
  "Usia",
  "Pendidikan",
  "Jurusan",
  "Institusi",
  "Status",
  "Bidang minat",
  "Jenis kerja",
  "Keahlian",
  "Pengalaman",
  "Link",
  "Terdaftar",
  "Akun tertaut",
];

/** Registrants as a CSV file (Excel opens it as UTF-8 thanks to the BOM). */
export function preregCsv(rows: { code: string; data: unknown; createdAt: Date | number; linkedAt: Date | number | null }[]) {
  const lines = [PREREG_CSV_HEADER.map(csvCell).join(",")];
  for (const r of rows) {
    const d = (r.data ?? {}) as Partial<PreregData>;
    lines.push(
      [
        r.code,
        d.fullName,
        d.email,
        d.whatsapp,
        d.city,
        d.age,
        d.education,
        d.major,
        d.institution,
        d.status,
        (d.fields ?? []).join("; "),
        (d.jobTypes ?? []).join("; "),
        d.skills,
        d.experience,
        d.link,
        new Date(r.createdAt).toISOString(),
        r.linkedAt ? new Date(r.linkedAt).toISOString() : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
