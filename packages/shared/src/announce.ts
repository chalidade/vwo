// The organiser's announcements to everyone in the hall. On the live site they are their own server
// document ("announce" in fair_state), changed one step at a time through the API, so a browser
// pushing an older copy of the event setup can never bring a deleted announcement back.

export interface Announcement {
  id: string;
  text: string;
  at: number;
}

/** The one on screen (if any) and the ones sent before, newest first. */
export interface AnnounceBoard {
  current: string | null;
  history: Announcement[];
}

export const ANNOUNCE_KEY = "announce";
export const ANNOUNCE_MAX = 200;
/** How many past announcements are kept for the organiser. */
export const ANNOUNCE_HISTORY = 20;
export const EMPTY_BOARD: AnnounceBoard = { current: null, history: [] };

const ID = /^[\w-]{1,40}$/;
const clean = (t: unknown) =>
  typeof t === "string"
    ? t
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, ANNOUNCE_MAX)
    : "";

/** A stored board, checked again: unknown shapes become an empty board. */
export function cleanBoard(v: unknown): AnnounceBoard {
  const d = (v ?? {}) as { current?: unknown; history?: unknown };
  const history = (Array.isArray(d.history) ? d.history : [])
    .map((a) => a as Partial<Announcement>)
    .filter((a) => typeof a.id === "string" && ID.test(a.id) && clean(a.text) && typeof a.at === "number" && Number.isFinite(a.at))
    .map((a) => ({ id: a.id!, text: clean(a.text), at: a.at! }))
    .slice(0, ANNOUNCE_HISTORY);
  const current = typeof d.current === "string" && history.some((a) => a.id === d.current) ? d.current : null;
  return { current, history };
}

/** The announcement on screen now, or undefined. */
export const currentAnnouncement = (b: AnnounceBoard) => b.history.find((a) => a.id === b.current);

/** Send a new announcement: it goes on screen and to the top of the history. Empty text changes nothing. */
export function postAnnouncement(b: AnnounceBoard, text: string, at: number, id: string): AnnounceBoard {
  const t = clean(text);
  if (!t) return b;
  return { current: id, history: [{ id, text: t, at }, ...b.history.filter((a) => a.id !== id)].slice(0, ANNOUNCE_HISTORY) };
}

/** Take the announcement off every visitor's screen; it stays in the history. */
export const hideAnnouncement = (b: AnnounceBoard): AnnounceBoard => ({ ...b, current: null });

/** Show a past announcement again, as new: visitors who closed it see it once more. */
export function repostAnnouncement(b: AnnounceBoard, id: string, at: number, newId: string): AnnounceBoard {
  const a = b.history.find((x) => x.id === id);
  return a ? postAnnouncement({ ...b, history: b.history.filter((x) => x.id !== id) }, a.text, at, newId) : b;
}

/** Delete one announcement for good; when it was on screen, the screen is cleared too. */
export function removeAnnouncement(b: AnnounceBoard, id: string): AnnounceBoard {
  return { current: b.current === id ? null : b.current, history: b.history.filter((a) => a.id !== id) };
}

/**
 * The board from before announcements had their own document: the one in the event setup, if any.
 * Used until the organiser first changes the board.
 */
export function legacyBoard(org: { announcement?: { text?: unknown; at?: unknown } } | null | undefined): AnnounceBoard {
  const a = org?.announcement;
  const text = clean(a?.text);
  if (!text || typeof a?.at !== "number") return EMPTY_BOARD;
  const id = `a${a.at}`;
  return { current: id, history: [{ id, text, at: a.at }] };
}
