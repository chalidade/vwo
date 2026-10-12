// What the Perpustakaan remembers in this browser: where each book was left (as a character
// position, so it survives a new layout or a smaller screen), and the reader's zoom and colours.

export type ReaderTheme = "light" | "sepia" | "dark";
/** Zoom steps over "fit the screen", like a PDF viewer's. The pages themselves never reflow. */
export const ZOOMS = [1, 1.25, 1.5, 1.75, 2] as const;

export interface ReadingSpot {
  id: number;
  title: string;
  author: string;
  /** First character of the page last open, counted over the book's text. */
  pos: number;
  /** How far through the book, 0 to 100, for the progress bar. */
  pct: number;
  at: number;
}

export interface LibraryPrefs {
  /** An index into ZOOMS. */
  zoom: number;
  theme: ReaderTheme;
  books: ReadingSpot[];
}

const KEY = "vwo:library";
/** How many books the "Lanjut baca" list keeps. */
export const RECENT_MAX = 12;

const DEFAULTS: LibraryPrefs = { zoom: 0, theme: "sepia", books: [] };

/** Read the saved settings, tolerating anything broken or missing. */
export function parsePrefs(raw: string | null): LibraryPrefs {
  try {
    const d = JSON.parse(raw ?? "null") as Partial<LibraryPrefs> | null;
    if (!d || typeof d !== "object") return { ...DEFAULTS };
    const zoom = Number.isInteger(d.zoom) && d.zoom! >= 0 && d.zoom! < ZOOMS.length ? d.zoom! : DEFAULTS.zoom;
    const theme = d.theme === "light" || d.theme === "dark" || d.theme === "sepia" ? d.theme : DEFAULTS.theme;
    const books = (Array.isArray(d.books) ? d.books : [])
      .filter((b): b is ReadingSpot => !!b && Number.isInteger(b.id) && b.id > 0 && typeof b.title === "string" && Number.isFinite(b.pos) && Number.isFinite(b.pct))
      .map((b) => ({
        id: b.id,
        title: b.title.slice(0, 200),
        author: String(b.author ?? "").slice(0, 120),
        pos: Math.max(0, b.pos),
        pct: Math.min(100, Math.max(0, Math.round(b.pct))),
        at: Number(b.at) || 0,
      }))
      .slice(0, RECENT_MAX);
    return { zoom, theme, books };
  } catch {
    return { ...DEFAULTS };
  }
}

export function loadPrefs(): LibraryPrefs {
  try {
    return parsePrefs(localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(p: LibraryPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Blocked storage: the place is only kept while the page is open.
  }
}

/** Remember where a book is: it moves to the top of "Lanjut baca", the list stays short. */
export function rememberSpot(p: LibraryPrefs, spot: ReadingSpot): LibraryPrefs {
  return { ...p, books: [spot, ...p.books.filter((b) => b.id !== spot.id)].slice(0, RECENT_MAX) };
}

/** Progress through a book, 0 to 100, from the character position at the end of the open page. */
export const percentRead = (end: number, total: number) => Math.min(100, Math.max(0, Math.round((end / Math.max(1, total)) * 100)));
