// The check on vacancies a company saves, apart from job-lists.ts so the browser doesn't download zod.
import { z } from "zod";
import type { JobPosting } from "./jobfair";
import { EDUCATION_LIST, EXPERIENCE_LIST, LOCATION_LIST, MAJOR_LIST, MAX_JOBS, type PickList, POSITION_LIST, QUALIFICATION_LIST, joinList, parseList } from "./job-lists";

const clip = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) || undefined : undefined), z.string().optional());
const listText = (list: PickList) => z.preprocess((v) => (typeof v === "string" ? joinList(list, parseList(list, v)) || undefined : undefined), z.string().optional());

/** One vacancy as a company may save it: known fields only, lists cleaned, every text bounded. */
export const jobPostingSchema = z.object({
  id: z.string().regex(/^[\w-]{1,120}$/),
  title: z.preprocess((v) => (typeof v === "string" ? joinList(POSITION_LIST, parseList(POSITION_LIST, v, 60)).slice(0, 160) : v), z.string().min(1)),
  type: z.enum(["Full-time", "Kontrak", "Magang", "Part-time"]).catch("Full-time"),
  location: clip(160).transform((v) => v ?? ""),
  salary: clip(60),
  requirements: z.preprocess((v) => parseList(QUALIFICATION_LIST, Array.isArray(v) ? v : []), z.array(z.string())),
  description: clip(1200),
  closed: z.boolean().optional().catch(undefined),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  quota: z.number().int().min(1).max(999).optional().catch(undefined),
  education: listText(EDUCATION_LIST),
  major: listText(MAJOR_LIST),
  experience: listText(EXPERIENCE_LIST),
  city: listText(LOCATION_LIST),
});

/** A booth's vacancies as sent by a browser: the ones that can't be read are left out. */
export function cleanJobs(raw: unknown): JobPosting[] {
  if (!Array.isArray(raw)) return [];
  const out: JobPosting[] = [];
  for (const j of raw.slice(0, MAX_JOBS)) {
    const r = jobPostingSchema.safeParse(j);
    if (!r.success) continue;
    // Leave out the optional fields that are empty, as the portal saves them.
    out.push(Object.fromEntries(Object.entries(r.data).filter(([, v]) => v !== undefined)) as unknown as JobPosting);
  }
  return out;
}
