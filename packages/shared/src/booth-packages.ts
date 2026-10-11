// What each booth package includes. The mini package (for UMKM) has no stand on the hall floor and
// one open vacancy; it is listed in the "Pojok UMKM" of the job lists instead. Any company can buy
// the featured vacancy add-on: one of its open vacancies goes to the top of the lists.
import type { JobPosting } from "./jobfair";

export type BoothTier = "premium" | "regular" | "mini";

export const BOOTH_TIERS: BoothTier[] = ["mini", "regular", "premium"];

/** How a package is named on bills, lists and the registration page. */
export const TIER_LABEL: Record<BoothTier, string> = { mini: "Paket mini UMKM", regular: "Stand reguler", premium: "Stand VIP" };

/** Where the mini booths are listed. */
export const UMKM_CORNER = "Pojok UMKM";

/** Open vacancies a mini booth may have at once. */
export const MINI_MAX_OPEN_JOBS = 1;

/** The add-on that puts one vacancy at the top of the lists. */
export const FEATURED_PRODUCT_ID = "featured";

/** Whether the booth stands on a hall floor. Mini booths are only listed. */
export const hasStand = (b: { tier?: string }) => b.tier !== "mini";

/** How many open vacancies the booth may have; Infinity without a limit. */
export const openJobLimit = (b: { tier?: string }) => (b.tier === "mini" ? MINI_MAX_OPEN_JOBS : Infinity);

/** Whether the booth may have one more open vacancy than it has now. `except` is the vacancy being edited. */
export function canOpenAnotherJob(b: { tier?: string; jobs: JobPosting[] }, except?: string) {
  return b.jobs.filter((j) => !j.closed && j.id !== except).length < openJobLimit(b);
}

/**
 * The booth's vacancies within its package: past the limit, the later open ones are closed (kept
 * in the list so their applicants keep their history, but no longer taking applications).
 */
export function limitOpenJobs(tier: string | undefined, jobs: JobPosting[]): JobPosting[] {
  const limit = openJobLimit({ tier });
  let open = 0;
  return jobs.map((j) => (j.closed || ++open <= limit ? j : { ...j, closed: true }));
}

/** Products a booth of this package can buy: a mini booth has no stand to upgrade or decorate. */
export function productAllowed(tier: string | undefined, productId: string) {
  if (tier !== "mini") return true;
  return productId === FEATURED_PRODUCT_ID || productId === "promoter";
}

/** The booth's featured vacancy, when it set one that is still open. */
export function featuredJob(b: { featuredJob?: string; jobs: JobPosting[] }) {
  return b.featuredJob ? b.jobs.find((j) => j.id === b.featuredJob && !j.closed) : undefined;
}

/** Whether this vacancy is the booth's featured one. */
export const isFeatured = (b: { featuredJob?: string; jobs: JobPosting[] }, jobId: string) => featuredJob(b)?.id === jobId;

/** Every featured vacancy that is still open, with its booth, in booth order. */
export function featuredJobs<B extends { featuredJob?: string; jobs: JobPosting[] }>(booths: B[]) {
  return booths.flatMap((booth) => {
    const job = featuredJob(booth);
    return job ? [{ booth, job }] : [];
  });
}

/** A list of vacancies with the featured ones first, otherwise in the same order. */
export function featuredFirst<T extends { booth: { featuredJob?: string; jobs: JobPosting[] }; job: { id: string } }>(list: T[]): T[] {
  const top = list.filter((x) => isFeatured(x.booth, x.job.id));
  return top.length ? [...top, ...list.filter((x) => !isFeatured(x.booth, x.job.id))] : list;
}
