import "server-only";
import { type BookEl, type BookNode, type BookTag, bookImageOf, gutenbergField } from "@vwo/shared";
import { Parser } from "htmlparser2";

// Gutenberg's HTML edition of a book, cut down to the few tags the reader shows. This is an
// allowlist, not a blocklist: a tag on KEEP survives with at most an image's file name, alt text and
// size; layout tags (div, section, center...) are unwrapped into paragraphs; inline tags we do not
// know (span, a, sup...) are unwrapped to their text; script, style, forms, frames, svg and the like
// are dropped with everything in them. No attribute of the book's survives except those four on an
// img, and an img survives only when it points into the book's own images folder. Gutenberg's own
// header and footer are taken out of the book and kept apart as its licence.

const KEEP = new Set<string>([
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
]);
/** Layout boxes: their content is kept, as paragraphs of their own. */
const BOXES = new Set([
  "div",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "center",
  "figure",
  "figcaption",
  "aside",
  "nav",
  "dl",
  "dt",
  "dd",
  "address",
  "hgroup",
  "body",
  "html",
]);
/** Dropped, with everything inside them. */
const DROP = new Set([
  "script",
  "style",
  "head",
  "title",
  "noscript",
  "template",
  "svg",
  "math",
  "iframe",
  "object",
  "embed",
  "form",
  "select",
  "textarea",
  "button",
  "input",
  "audio",
  "video",
  "canvas",
  "map",
  "area",
  "link",
  "meta",
  "base",
  "frameset",
  "frame",
  "param",
  "source",
  "track",
  "picture",
  "dialog",
]);
const RENAME: Record<string, BookTag> = { h5: "h4", h6: "h4" };
const BLOCK = new Set<string>(["p", "h1", "h2", "h3", "h4", "blockquote", "pre", "hr", "ul", "ol", "table", "img", "div"]);
const MAX_NODES = 400_000;
const MAX_DEPTH = 48;

/** The tree while it is parsed: a "div" is a layout box, unwrapped at the end. */
type Raw = string | RawEl;
interface RawEl {
  t: BookTag | "div";
  c: Raw[];
  k?: "v" | "c";
  src?: string;
  alt?: string;
  w?: number;
  h?: number;
}
type Frame = { kind: "keep" | "box"; el: RawEl } | { kind: "pass" | "drop" | "boiler" | "title" };

export class BookHtmlError extends Error {}

const hintOf = (cls: string): "v" | "c" | undefined =>
  /\b(?:poem|poetry|stanza|verse|line\d*|i\d+)\b/i.test(cls) ? "v" : /\b(?:center|centre|c|caption|figcenter|titlepage)\b/i.test(cls) ? "c" : undefined;
const size = (v: string | undefined) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 3000 ? n : undefined;
};

/** An img that points into the book's own images folder, or null. */
function image(a: Record<string, string>): RawEl | null {
  const m = /^(?:\.\/)?images\/([^/?#]+)$/.exec(a.src ?? "");
  const file = m ? bookImageOf(m[1]) : null;
  if (!file) return null;
  const el: RawEl = { t: "img", c: [], src: file };
  const alt = (a.alt ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (alt) el.alt = alt;
  const w = size(a.width);
  const h = size(a.height);
  if (w && h) Object.assign(el, { w, h });
  return el;
}

/** Parse Gutenberg's HTML into the book and its licence. Throws BookHtmlError when what is left is too
 *  little to be the book (an error page, or a file that is all header). */
export function htmlBook(html: string, id: number) {
  const root: RawEl = { t: "div", c: [] };
  const stack: Frame[] = [{ kind: "box", el: root }];
  let nodes = 0;
  let depth = 0;
  let pre = 0;
  let quiet = 0;
  let boiler = 0;
  let docTitle = "";
  const licence: string[] = [];
  const parent = () => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const f = stack[i]!;
      if (f.kind === "keep" || f.kind === "box") return f.el;
    }
    return root;
  };
  const add = (n: Raw) => {
    if (++nodes > MAX_NODES) throw new BookHtmlError("too_many_nodes");
    parent().c.push(n);
  };

  const parser = new Parser(
    {
      onopentag(raw, a) {
        const name = RENAME[raw] ?? raw;
        if (name === "title" && !docTitle) {
          stack.push({ kind: "title" });
          quiet++;
          return;
        }
        if (quiet) {
          stack.push({ kind: "drop" });
          quiet++;
          return;
        }
        const cls = a.class ?? "";
        if (boiler) {
          stack.push({ kind: "boiler" });
          boiler++;
          if (name === "br") licence.push("\n");
          return;
        }
        if (a.id === "pg-header" || a.id === "pg-footer" || /\bpg-boilerplate\b/.test(cls)) {
          stack.push({ kind: "boiler" });
          boiler++;
          licence.push("\n\n");
          return;
        }
        // Gutenberg's printed page numbers, "[Pg 12]", mean nothing on our pages.
        if (DROP.has(name) || /\bpagenum\b/.test(cls)) {
          stack.push({ kind: "drop" });
          quiet++;
          return;
        }
        if (name === "img") {
          const el = image(a);
          if (el) add(el);
          stack.push({ kind: "pass" });
          return;
        }
        if (KEEP.has(name) && depth < MAX_DEPTH) {
          const el: RawEl = { t: name as BookTag, c: [] };
          const k = name === "p" || name === "blockquote" ? hintOf(cls) : undefined;
          if (k) el.k = k;
          add(el);
          stack.push({ kind: "keep", el });
          depth++;
          if (name === "pre") pre++;
          return;
        }
        if (BOXES.has(name) && depth < MAX_DEPTH) {
          const el: RawEl = { t: "div", c: [] };
          const k = name === "center" ? "c" : hintOf(cls);
          if (k) el.k = k;
          add(el);
          stack.push({ kind: "box", el });
          depth++;
          return;
        }
        stack.push({ kind: "pass" });
      },
      ontext(text) {
        const f = stack[stack.length - 1]!;
        if (f.kind === "title") {
          docTitle += text;
          return;
        }
        if (boiler) {
          licence.push(text.replace(/\s+/g, " "));
          return;
        }
        if (quiet) return;
        const t = pre ? text : text.replace(/\s+/g, " ");
        if (!t) return;
        const into = parent().c;
        const last = into[into.length - 1];
        if (typeof last === "string") into[into.length - 1] = last + t;
        else add(t);
      },
      onclosetag(raw) {
        const name = RENAME[raw] ?? raw;
        const f = stack.pop();
        if (!f) return;
        if (f.kind === "drop" || f.kind === "title") quiet--;
        else if (f.kind === "boiler") {
          boiler--;
          if (/^(?:p|div|li|h\d|tr|br|section)$/.test(name)) licence.push("\n");
        } else if (f.kind === "keep" || f.kind === "box") {
          depth--;
          if (f.el.t === "pre") pre--;
        }
      },
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true, recognizeSelfClosing: true },
  );
  parser.write(html);
  parser.end();

  const blocks = flow(root.c);
  const text = blocks.reduce((n, b) => n + textSize(b), 0);
  if (text < 200) throw new BookHtmlError("too_little");

  const lic = licence
    .join("")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 200_000);
  const startAt = lic.search(/\*{3}\s*START OF/i);
  const head = startAt > 0 ? lic.slice(0, startAt) : lic;
  const t = docTitle
    .replace(/\s+/g, " ")
    .replace(/\s*\|\s*Project Gutenberg\s*$/i, "")
    .trim();
  return {
    title: (gutenbergField(head, "Title") || t || `Buku #${id}`).slice(0, 200),
    author: gutenbergField(head, "Author"),
    language: gutenbergField(head, "Language"),
    blocks,
    licence: lic,
  };
}

const textSize = (n: BookNode): number => (typeof n === "string" ? n.trim().length : (n.c ?? []).reduce((s, c) => s + textSize(c), 0));
const isBr = (n: BookNode) => typeof n !== "string" && n.t === "br";
const blank = (n: Raw) => typeof n === "string" && !n.trim();
const isBlock = (n: Raw) => typeof n !== "string" && BLOCK.has(n.t);

/** Block-level content: runs of loose text and inline tags become paragraphs, layout boxes are
 *  unwrapped into their own blocks, and a box's verse or centring hint passes to its paragraphs. */
function flow(kids: Raw[], hint?: "v" | "c"): BookNode[] {
  const out: BookNode[] = [];
  let run: Raw[] = [];
  const flush = () => {
    const inl = inline(run);
    run = [];
    if (!inl.some((n) => typeof n !== "string" || n.trim())) return;
    // Trim the run's ends: spaces between blocks are not part of the text.
    if (typeof inl[0] === "string") inl[0] = inl[0].replace(/^\s+/, "");
    const end = inl.length - 1;
    if (typeof inl[end] === "string") inl[end] = (inl[end] as string).replace(/\s+$/, "");
    const p: BookEl = { t: "p", c: inl.filter((n) => n !== "") };
    if (hint) p.k = hint;
    out.push(p);
  };
  for (const n of kids) {
    if (!isBlock(n)) {
      run.push(n);
      continue;
    }
    flush();
    const el = n as RawEl;
    if (el.t === "div") out.push(...flow(el.c, el.k ?? hint));
    else out.push(block(el, hint));
  }
  flush();
  return out;
}

/** One block tag with its content cleaned the way that tag needs it. */
function block(el: RawEl, hint?: "v" | "c"): BookEl {
  const k = el.k ?? (el.t === "p" ? hint : undefined);
  const base = (c: BookNode[]): BookEl => (k ? { t: el.t as BookTag, k, c } : { t: el.t as BookTag, c });
  switch (el.t) {
    case "img":
      return { t: "img", src: el.src!, ...(el.alt ? { alt: el.alt } : {}), ...(el.w ? { w: el.w, h: el.h } : {}) };
    case "hr":
      return { t: "hr" };
    case "blockquote":
      return base(flow(el.c, k));
    case "ul":
    case "ol":
      return base(only(el.c, ["li"], "li"));
    case "table":
      return base(only(el.c, ["caption", "thead", "tbody", "tfoot", "tr"]));
    case "pre":
      return { t: "pre", c: inline(el.c) };
    default:
      return base(inline(el.c));
  }
}

/** The children a list or table part may have; loose content in a list becomes an item. */
function only(kids: Raw[], allowed: string[], wrap?: "li"): BookNode[] {
  const out: BookNode[] = [];
  for (const n of kids) {
    if (blank(n)) continue;
    if (typeof n !== "string" && allowed.includes(n.t)) out.push(part(n));
    else if (wrap && typeof n !== "string" && n.t === "div") out.push(...only(n.c, allowed, wrap));
    else if (wrap) out.push(part({ t: wrap, c: [n] }));
  }
  return out;
}

/** A list item or a table part, whose own children are checked in turn. */
function part(el: RawEl): BookEl {
  switch (el.t) {
    case "thead":
    case "tbody":
    case "tfoot":
      return { t: el.t, c: only(el.c, ["tr"]) };
    case "tr":
      return { t: "tr", c: only(el.c, ["td", "th"]) };
    case "li":
    case "td":
    case "th":
      return { t: el.t, c: el.c.some(isBlock) ? flow(el.c) : inline(el.c) };
    default:
      return { t: el.t as BookTag, c: inline(el.c) };
  }
}

/** Inline content: text, emphasis, line breaks and pictures. A block that turns up inside (a div in
 *  a paragraph) gives up its text, on a line of its own. */
function inline(kids: Raw[]): BookNode[] {
  const out: BookNode[] = [];
  const push = (n: BookNode) => {
    const last = out[out.length - 1];
    if (typeof n === "string" && typeof last === "string") out[out.length - 1] = last + n;
    else out.push(n);
  };
  for (const n of kids) {
    if (typeof n === "string") push(n);
    else if (n.t === "br") push({ t: "br" });
    else if (n.t === "img") push(block(n));
    else if (n.t === "em" || n.t === "i" || n.t === "b" || n.t === "strong") push({ t: n.t, c: inline(n.c) });
    else {
      const inner = n.t === "hr" ? [] : inline(n.c);
      if (!inner.length) continue;
      if (out.length && !isBr(out[out.length - 1]!)) push({ t: "br" });
      for (const x of inner) push(x);
      if (BLOCK.has(n.t)) push({ t: "br" });
    }
  }
  // No line breaks or spaces at the end, and none at the start of a new line.
  while (out.length && (isBr(out[out.length - 1]!) || out[out.length - 1] === " ")) out.pop();
  for (let i = 1; i < out.length; i++) if (isBr(out[i - 1]!) && typeof out[i] === "string") out[i] = (out[i] as string).replace(/^ +/, "");
  for (let i = 0; i + 1 < out.length; i++) if (isBr(out[i + 1]!) && typeof out[i] === "string") out[i] = (out[i] as string).replace(/ +$/, "");
  return out.filter((n) => n !== "");
}
