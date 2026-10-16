// The checks on the talent pool's requests, apart from talent-pool.ts so the browser doesn't download zod.
import { z } from "zod";

export const poolFilterSchema = z.object({
  q: z.string().trim().max(80).optional(),
  skill: z.string().trim().max(80).optional(),
  province: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  education: z.string().trim().max(80).optional(),
  status: z.string().trim().max(40).optional(),
});
export type PoolFilter = z.infer<typeof poolFilterSchema>;

export const talentOfferSchema = z.object({
  /** A past applicant's account id, or the handle an opted-in stranger got in "Kandidat cocok". */
  seeker: z.string().regex(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|h_[0-9a-f]{32})$/i),
  jobId: z.string().regex(/^[\w-]{1,80}$/),
  note: z.string().trim().max(300).optional(),
});
