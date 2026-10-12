// A Perpustakaan book as the reader lays it out: a tree of a few plain tags (paragraphs, headings,
// emphasis, lists, tables, pictures) cut into sections that each start on a new page, the way the
// chapters of a printed book do. The server builds the tree from Gutenberg's HTML edition through an
// allowlist, or from the plain text when there is no HTML; the browser only ever renders these tags.

/** The only tags a book may contain. Anything else is unwrapped (its text kept) or dropped. */
export const BOOK_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "em",
  "i",
  "b",
  "strong",
  "blockquote",
  "pre",
  "br",
  "hr",
  "ul",
  "ol",
  "li",
  "table",
  "caption",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "img",
] as const;
export type BookTag = (typeof BOOK_TAGS)[number];

/** Text, or a tag with its children. `k` is our own hint, never the book's class: "v" verse (left
 *  aligned, no indent), "c" centred. An img has `src`, a bare file name in the book's images folder. */
export type BookNode = string | BookEl;
export interface BookEl {
  t: BookTag;
  c?: BookNode[];
  k?: "v" | "c";
  src?: string;
  alt?: string;
  w?: number;
  h?: number;
}

/** What the reader gets for one book. `format` says whether it came from the HTML edition or the text. */
export interface LibraryBookOut {
  id: number;
  title: string;
  author: string;
  language: string;
  format: "html" | "text";
  blocks: BookNode[];
  /** Project Gutenberg's header and licence, kept with the book as the licence asks. */
  licence: string;
}

/** The largest HTML edition the server takes; a bigger one falls back to the plain text. */
export const LIBRARY_HTML_MAX = 6_000_000;
/** The largest picture the server passes on. */
export const LIBRARY_IMAGE_MAX = 2_000_000;

/** Where a book's HTML edition lives. Only ever built from a number checked by bookIdOf. */
export const gutenbergHtmlUrl = (id: number) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}-images.html`;

const IMAGE_FILE = /^[A-Za-z0-9_-]{1,80}\.(?:jpe?g|png|gif)$/;
/** A picture's file name from the browser, or null: letters, digits, - and _, then .jpg, .png or .gif. */
export function bookImageOf(raw: unknown): string | null {
  return typeof raw === "string" && IMAGE_FILE.test(raw) ? raw : null;
}
/** A picture of a book on Gutenberg. Only ever built from bookIdOf and bookImageOf. */
export const gutenbergImageUrl = (id: number, file: string) => `https://www.gutenberg.org/cache/epub/${id}/images/${file}`;
/** The content type we send for a picture, from its file name (never from upstream). */
export const bookImageType = (file: string) => (/\.png$/i.test(file) ? "image/png" : /\.gif$/i.test(file) ? "image/gif" : "image/jpeg");

const isEl = (n: BookNode): n is BookEl => typeof n !== "string";

/** All the text in a node, for lengths and titles. */
export function nodeText(n: BookNode): string {
  if (!isEl(n)) return n;
  if (n.t === "br") return "\n";
  return (n.c ?? []).map(nodeText).join("");
}

/** About how much room a node takes, in characters: its text, and a little for a picture or a rule. */
export function nodeSize(n: BookNode): number {
  if (!isEl(n)) return n.length;
  if (n.t === "img") return 400;
  if (n.t === "hr" || n.t === "br") return 1;
  let size = 0;
  for (const c of n.c ?? []) size += nodeSize(c);
  return size;
}

const CHAPTER =
  /^(?:chapter|book|part|act|scene|stave|letter|canto|volume|section|bab)\b[\s\S]{0,70}$|^[IVXLC]{1,7}\.?$|^(?:preface|introduction|contents|epilogue|prologue|appendix|conclusion)\.?$/i;

/** Text with Gutenberg's _underscore italics_ as real italics. */
function styled(s: string): BookNode[] {
  const out: BookNode[] = [];
  let at = 0;
  for (const m of s.matchAll(/(^|[^\w])_([^_\n]{1,300}?)_(?![\w])/g)) {
    const from = m.index + m[1]!.length;
    if (from > at) out.push(s.slice(at, from));
    out.push({ t: "i", c: [m[2]!] });
    at = from + m[2]!.length + 2;
  }
  if (at < s.length) out.push(s.slice(at));
  return out;
}

/** The plain-text pipeline's paragraphs as a book: short "CHAPTER ..." lines become headings,
 *  _underscores_ italics, lines set far in from the margin are centred, verse and lists keep their
 *  line breaks, and bare "[Illustration]" markers (pictures we do not have) are left out. */
export function textBlocks(paragraphs: readonly string[]): BookNode[] {
  const out: BookNode[] = [];
  for (const p of paragraphs) {
    const one = p.trim();
    if (/^\[Illustration\]$/i.test(one)) continue;
    if (/^\[Illustration:/i.test(one)) {
      out.push({ t: "p", k: "c", c: [{ t: "i", c: [one.replace(/\s+/g, " ")] }] });
      continue;
    }
    if (!one.includes("\n") && one.length <= 80 && CHAPTER.test(one)) {
      out.push({ t: "h2", c: [one] });
      continue;
    }
    const lines = p.split("\n");
    const centred = lines.every((l) => !l.trim() || /^ {8,}/.test(l));
    if (lines.length === 1) {
      out.push(centred ? { t: "p", k: "c", c: styled(one) } : { t: "p", c: styled(p) });
      continue;
    }
    const c: BookNode[] = [];
    lines.forEach((l, i) => {
      if (i) c.push({ t: "br" });
      const line = centred ? l.trim() : l.replace(/^ +/, (sp) => "\u00a0".repeat(sp.length));
      if (line) c.push(...styled(line));
    });
    out.push({ t: "p", k: centred ? "c" : "v", c });
  }
  return out;
}

export interface BookSection {
  /** The section's first heading, for the contents list and the running head. */
  title: string;
  blocks: BookNode[];
  /** Where it starts, in characters from the start of the book, and how long it is. */
  start: number;
  size: number;
}

const isHeading = (n: BookNode) => isEl(n) && (n.t === "h1" || n.t === "h2" || n.t === "h3" || n.t === "h4");
const isBreak = (n: BookNode) => isEl(n) && (n.t === "h1" || n.t === "h2");

/** Cut a book into sections that each start on a new page: at every h1 and h2, and inside a very
 *  long stretch without headings, so no one section is too much to lay out at once. A section of
 *  nothing but headings (a part title before its first chapter) stays with the next one. */
export function bookSections(blocks: readonly BookNode[], max = 120_000): BookSection[] {
  const out: BookSection[] = [];
  let cur: BookNode[] = [];
  let size = 0;
  let content = false;
  let start = 0;
  const flush = () => {
    if (!cur.length) return;
    const head = cur.find(isHeading);
    const title = head ? nodeText(head).replace(/\s+/g, " ").trim().slice(0, 80) : "";
    out.push({ title, blocks: cur, start, size });
    start += size;
    cur = [];
    size = 0;
    content = false;
  };
  for (const b of blocks) {
    const s = nodeSize(b);
    if (content && (isBreak(b) || (size + s > max && size > 0))) flush();
    cur.push(b);
    size += s;
    if (!isHeading(b)) content = true;
  }
  flush();
  return out;
}

/** The section and how far into it (0 to 1) a character position in the book falls. */
export function sectionAt(sections: readonly BookSection[], pos: number): { sec: number; frac: number } {
  if (!sections.length) return { sec: 0, frac: 0 };
  let sec = sections.findIndex((s) => pos < s.start + s.size);
  if (sec < 0) sec = sections.length - 1;
  const s = sections[sec]!;
  return { sec, frac: Math.min(1, Math.max(0, (pos - s.start) / Math.max(1, s.size))) };
}

/** True when a value from the network is a book tree made only of BOOK_TAGS, with sane attributes. */
export function isBookTree(v: unknown, depth = 0): v is BookNode[] {
  if (!Array.isArray(v) || depth > 40) return false;
  return v.every((n) => {
    if (typeof n === "string") return true;
    if (!n || typeof n !== "object") return false;
    const e = n as BookEl;
    if (!(BOOK_TAGS as readonly string[]).includes(e.t)) return false;
    if (e.src !== undefined && (e.t !== "img" || bookImageOf(e.src) == null)) return false;
    return e.c === undefined || isBookTree(e.c, depth + 1);
  });
}
