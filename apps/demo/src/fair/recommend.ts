// Which vacancies and booths suit a job seeker. The matcher lives in @vwo/shared so the server can
// run it the other way round too (candidates for a company's vacancy, see talent-pool.ts).
export { type BoothMatch, type JobMatch, type ProfileHints, canRecommend, recommendBooths, recommendJobs, scoreJob, words } from "@vwo/shared";
