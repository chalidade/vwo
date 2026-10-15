import { type PreregEventRow, type PreregRegistrationRow, preregFormData, preregSignals } from "@vwo/db";
import { SUSPECT_AT, preregState, suspicion } from "@vwo/shared";

/** An event as the organiser hub edits it. */
export const adminEvent = (e: PreregEventRow, count: number, slowUntil: Date | null = null) => ({
  id: e.id,
  slug: e.slug,
  name: e.name,
  startDate: e.startDate ?? "",
  endDate: e.endDate ?? "",
  location: e.location,
  about: e.about ?? "",
  banner: e.banner,
  capacity: e.capacity,
  open: e.open,
  deadline: e.deadline?.getTime() ?? null,
  count,
  state: preregState(e, count),
  createdAt: e.createdAt.getTime(),
  /** Slow mode (too many sign-ups at once) until then. */
  slowUntil: slowUntil?.getTime() ?? null,
});

/** A registrant with everything they sent: for event admins only. `flag` is how suspicious it looks among the rest. */
export const adminRegistrant = (r: PreregRegistrationRow, flag?: { score: number; reasons: string[] }) => ({
  id: r.id,
  code: r.code,
  email: r.email,
  data: preregFormData(r.data),
  suspect: flag ? { score: flag.score, reasons: flag.reasons, flagged: flag.score >= SUSPECT_AT } : null,
  at: r.createdAt.getTime(),
  updatedAt: r.updatedAt.getTime(),
  linkedAt: r.linkedAt?.getTime() ?? null,
});

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Each registrant with how suspicious it looks among all of this event's (see @vwo/shared antibot.ts suspicion). */
export function adminRegistrants(rows: PreregRegistrationRow[]) {
  const flags = suspicion(
    rows.map((r) => {
      const d = preregFormData(r.data);
      return {
        id: r.id,
        email: r.email,
        signals: preregSignals(r.data),
        names: { fullName: d.fullName, city: d.city },
        others: { institution: d.institution, major: d.major, skills: d.skills, experience: d.experience },
      };
    }),
  );
  return rows.map((r) => adminRegistrant(r, flags.get(r.id)));
}
