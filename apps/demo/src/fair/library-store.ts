// What the Perpustakaan remembers in this browser: where each book was left (as a character
// position, so it survives a change of font size), and the reader's font size and colours.

export type ReaderTheme = "light" | "sepia" | "dark";
export const FONT_SIZES = [15, 17, 19, 22, 25] as const;

export interface ReadingSpot {
  id: number;
  title: string;
  author: string;
  /** First character of the page last open. */
  pos: number;
  /** How far through the book, 0 to 100, for the progress bar. */
  pct: number;
  at: number;
}

export interface LibraryPrefs {
  font: number;
  theme: ReaderTheme;
  books: ReadingSpot[];
}

const KEY = "vwo:library";
/** How many books the "Lanjut baca" list keeps. */
export const RECENT_MAX = 12;

const DEFAULTS: LibraryPrefs = { font: 1, theme: "sepia", books: [] };

/** Read the saved settings, tolerating anything broken or missing. */
export function parsePrefs(raw: string | null): LibraryPrefs {
  try {
    const d = JSON.parse(raw ?? "null") as Partial<LibraryPrefs> | null;
    if (!d || typeof d !== "object") return { ...DEFAULTS };
    const font = Number.isInteger(d.font) && d.font! >= 0 && d.font! < FONT_SIZES.length ? d.font! : DEFAULTS.font;
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
    return { font, theme, books };
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

/** Progress through a book, 0 to 100: the share of pages up to and including the open one. */
export const percentRead = (page: number, pages: number) => Math.min(100, Math.max(0, Math.round(((page + 1) / Math.max(1, pages)) * 100)));

/** About how many characters fit on one page of the reader, for a page box and font size in pixels. */
export function charsPerPage(width: number, height: number, fontPx: number) {
  const perLine = Math.max(16, Math.floor(width / (fontPx * 0.45)));
  const lines = Math.max(6, Math.floor(height / (fontPx * 1.65)));
  // Paragraph gaps and short last lines take some room: aim a little under the full box.
  return Math.max(200, Math.floor(perLine * lines * 0.88));
}
