import type { PreregEventRow, PreregRegistrationRow } from "@vwo/db";
import { preregState } from "@vwo/shared";

/** An event as the organiser hub edits it. */
export const adminEvent = (e: PreregEventRow, count: number) => ({
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
});

/** A registrant with everything they sent: for event admins only. */
export const adminRegistrant = (r: PreregRegistrationRow) => ({
  id: r.id,
  code: r.code,
  email: r.email,
  data: r.data,
  at: r.createdAt.getTime(),
  updatedAt: r.updatedAt.getTime(),
  linkedAt: r.linkedAt?.getTime() ?? null,
});

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
