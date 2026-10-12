// The Perpustakaan: free books to read in the game. Full texts are public-domain books from Project
// Gutenberg, fetched one book at a time by our own server (the browser only ever sends a book's
// number, never a URL). Indonesian books come from free official sites, as links that open in a new
// tab. Pure helpers here: the shelves, the id and query checks, the Gutenberg boilerplate cut and
// the paging, shared by the API route and the reader.

/** A book on a shelf, by its Project Gutenberg number. */
export interface ShelfBook {
  id: number;
  title: string;
  author: string;
  /** One line about the book, in Indonesian. */
  note: string;
}

export interface LibraryShelf {
  id: string;
  title: string;
  about: string;
  /** Spine colour on the shelf drawings. */
  color: string;
  books: ShelfBook[];
}

const b = (id: number, title: string, author: string, note: string): ShelfBook => ({ id, title, author, note });

/** Hand-picked shelves. Every number was checked against gutenberg.org/ebooks/<id>; all are public
 *  domain in the US and in English (a few are translations). */
export const LIBRARY_SHELVES: LibraryShelf[] = [
  {
    id: "karier",
    title: "Karier & pengembangan diri",
    about: "Klasik tentang kerja keras, kebiasaan baik, dan berbicara di depan umum.",
    color: "#b45309",
    books: [
      b(20203, "Autobiography of Benjamin Franklin", "Benjamin Franklin", "Kisah hidup dan 13 kebajikan yang ia latih setiap hari."),
      b(4507, "As a Man Thinketh", "James Allen", "Esai pendek: pikiran membentuk keadaan hidup kita."),
      b(368, "Acres of Diamonds", "Russell H. Conwell", "Peluang sering ada di dekat kita sendiri."),
      b(16317, "The Art of Public Speaking", "J. Berg Esenwein & Dale Carnegie", "Latihan berbicara di depan umum, bab demi bab."),
      b(935, "Self-Help", "Samuel Smiles", "Ketekunan dan karakter, lewat kisah banyak tokoh."),
      b(2274, "How to Live on 24 Hours a Day", "Arnold Bennett", "Cara memakai waktu luang untuk berkembang."),
      b(132, "The Art of War", "Sun Tzu", "Strategi klasik yang sering dipakai di dunia bisnis."),
      b(2680, "Meditations", "Marcus Aurelius", "Catatan pribadi seorang kaisar tentang tenang dan disiplin."),
    ],
  },
  {
    id: "fiksi",
    title: "Fiksi klasik",
    about: "Novel-novel besar yang masih dibaca sampai sekarang.",
    color: "#7c3aed",
    books: [
      b(1342, "Pride and Prejudice", "Jane Austen", "Elizabeth Bennet, Mr. Darcy, dan gengsi."),
      b(2701, "Moby Dick", "Herman Melville", "Kapten Ahab memburu paus putih."),
      b(84, "Frankenstein", "Mary Shelley", "Ilmuwan yang menciptakan makhluk hidup."),
      b(98, "A Tale of Two Cities", "Charles Dickens", "London dan Paris di masa Revolusi Prancis."),
      b(1260, "Jane Eyre", "Charlotte Brontë", "Gadis yatim yang memegang teguh harga dirinya."),
      b(768, "Wuthering Heights", "Emily Brontë", "Cinta dan dendam di padang Yorkshire."),
      b(174, "The Picture of Dorian Gray", "Oscar Wilde", "Lukisan yang menua menggantikan pemiliknya."),
      b(2554, "Crime and Punishment", "Fyodor Dostoyevsky", "Seorang mahasiswa dan rasa bersalahnya."),
    ],
  },
  {
    id: "petualangan",
    title: "Petualangan & fiksi ilmiah",
    about: "Bajak laut, pulau terpencil, kapal selam, dan mesin waktu.",
    color: "#0f766e",
    books: [
      b(120, "Treasure Island", "Robert Louis Stevenson", "Peta harta karun dan Long John Silver."),
      b(103, "Around the World in Eighty Days", "Jules Verne", "Taruhan keliling dunia dalam 80 hari."),
      b(164, "Twenty Thousand Leagues under the Sea", "Jules Verne", "Kapten Nemo dan kapal selam Nautilus."),
      b(1184, "The Count of Monte Cristo", "Alexandre Dumas", "Kabur dari penjara, lalu membalas dendam."),
      b(1257, "The Three Musketeers", "Alexandre Dumas", "D'Artagnan dan tiga sahabatnya."),
      b(521, "Robinson Crusoe", "Daniel Defoe", "Bertahan hidup sendirian di pulau."),
      b(35, "The Time Machine", "H. G. Wells", "Perjalanan ke masa depan yang sangat jauh."),
      b(36, "The War of the Worlds", "H. G. Wells", "Mars menyerang Bumi."),
    ],
  },
  {
    id: "misteri",
    title: "Misteri & detektif",
    about: "Teka-teki untuk dipecahkan bersama sang detektif.",
    color: "#1e3a8a",
    books: [
      b(1661, "The Adventures of Sherlock Holmes", "Arthur Conan Doyle", "Dua belas kasus Sherlock Holmes."),
      b(2852, "The Hound of the Baskervilles", "Arthur Conan Doyle", "Anjing misterius di rawa Dartmoor."),
      b(244, "A Study in Scarlet", "Arthur Conan Doyle", "Pertemuan pertama Holmes dan Watson."),
      b(1155, "The Secret Adversary", "Agatha Christie", "Tommy dan Tuppence memburu dalang rahasia."),
      b(583, "The Woman in White", "Wilkie Collins", "Perempuan berbaju putih di jalan malam."),
      b(155, "The Moonstone", "Wilkie Collins", "Berlian India yang hilang."),
    ],
  },
  {
    id: "sains",
    title: "Sains",
    about: "Karya ilmuwan besar, ditulis untuk pembaca umum.",
    color: "#0369a1",
    books: [
      b(1228, "On the Origin of Species", "Charles Darwin", "Teori seleksi alam."),
      b(5001, "Relativity: The Special and General Theory", "Albert Einstein", "Relativitas dijelaskan oleh Einstein sendiri."),
      b(14474, "The Chemical History of a Candle", "Michael Faraday", "Kuliah sains populer dari sebatang lilin."),
    ],
  },
  {
    id: "sejarah",
    title: "Sejarah & biografi",
    about: "Kisah nyata dan catatan dari masa lalu.",
    color: "#9a3412",
    books: [
      b(23, "Narrative of the Life of Frederick Douglass", "Frederick Douglass", "Dari budak menjadi tokoh pembebasan."),
      b(2376, "Up from Slavery", "Booker T. Washington", "Membangun sekolah dari nol."),
      b(1232, "The Prince", "Niccolò Machiavelli", "Nasihat kekuasaan dari Italia abad ke-16."),
      b(2707, "The History of Herodotus, Volume 1", "Herodotus", "Sejarah Yunani dan Persia kuno."),
    ],
  },
  {
    id: "filsafat",
    title: "Filsafat",
    about: "Pertanyaan besar tentang hidup, keadilan, dan pengetahuan.",
    color: "#4d7c0f",
    books: [
      b(1497, "The Republic", "Plato", "Apa itu keadilan dan negara yang baik."),
      b(5827, "The Problems of Philosophy", "Bertrand Russell", "Pengantar filsafat yang ringkas."),
      b(4363, "Beyond Good and Evil", "Friedrich Nietzsche", "Menggugat moral yang dianggap pasti."),
    ],
  },
  {
    id: "anak",
    title: "Cerita anak",
    about: "Dongeng dan cerita yang enak dibaca segala usia.",
    color: "#db2777",
    books: [
      b(11, "Alice's Adventures in Wonderland", "Lewis Carroll", "Jatuh ke lubang kelinci."),
      b(16, "Peter Pan", "J. M. Barrie", "Anak yang tidak mau dewasa."),
      b(55, "The Wonderful Wizard of Oz", "L. Frank Baum", "Dorothy dan jalan bata kuning."),
      b(2591, "Grimms' Fairy Tales", "Brothers Grimm", "Dongeng-dongeng Grimm."),
      b(236, "The Jungle Book", "Rudyard Kipling", "Mowgli dibesarkan serigala."),
      b(113, "The Secret Garden", "Frances Hodgson Burnett", "Taman rahasia yang hidup kembali."),
      b(289, "The Wind in the Willows", "Kenneth Grahame", "Mole, Rat, dan Mr. Toad."),
      b(74, "The Adventures of Tom Sawyer", "Mark Twain", "Kenakalan di tepi Sungai Mississippi."),
    ],
  },
  {
    id: "puisi",
    title: "Puisi",
    about: "Sajak dan epos dari berbagai zaman.",
    color: "#be123c",
    books: [
      b(1065, "The Raven", "Edgar Allan Poe", "Burung gagak di tengah malam."),
      b(1322, "Leaves of Grass", "Walt Whitman", "Puisi bebas tentang manusia dan alam."),
      b(1041, "Shakespeare's Sonnets", "William Shakespeare", "154 soneta."),
      b(26, "Paradise Lost", "John Milton", "Epos tentang kejatuhan manusia."),
      b(8800, "The Divine Comedy", "Dante Alighieri", "Perjalanan melewati neraka sampai surga."),
      b(1727, "The Odyssey", "Homer", "Odysseus pulang ke Ithaka."),
    ],
  },
];

/** Every book on the shelves, by number. */
export const shelfBook = (id: number) => LIBRARY_SHELVES.flatMap((s) => s.books).find((x) => x.id === id);

/** Free Indonesian books on other sites: opened in a new tab (we could not confirm that they allow
 *  being shown in a frame, so they are never framed). */
export interface LinkSource {
  id: string;
  name: string;
  by: string;
  url: string;
  about: string;
}

export const LINK_SOURCES: LinkSource[] = [
  {
    id: "sibi",
    name: "SIBI · Buku Kemendikdasmen",
    by: "Pusat Perbukuan, Kementerian Pendidikan Dasar dan Menengah",
    url: "https://buku.kemdikbud.go.id/",
    about: "Buku teks pelajaran dan buku bacaan resmi, gratis dibaca dan diunduh.",
  },
  {
    id: "letsread",
    name: "Let's Read",
    by: "The Asia Foundation",
    url: "https://www.letsreadasia.org/",
    about: "Perpustakaan digital gratis berisi buku cerita bergambar, banyak dalam bahasa Indonesia dan bahasa daerah.",
  },
];

// --- Talking to the upstream sites, on the server only.

/** Hosts the server may fetch from, and nothing else. */
export const LIBRARY_HOSTS = ["www.gutenberg.org", "gutenberg.org", "gutendex.com"] as const;
/** The largest book text the server takes; bigger ones are refused, not cut. */
export const LIBRARY_TEXT_MAX = 3_000_000;
/** The largest search answer the server takes. */
export const LIBRARY_SEARCH_MAX = 1_000_000;

/** A Gutenberg book number from the browser, or null. Digits only, so it can never be a URL or a path. */
export function bookIdOf(raw: unknown): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw);
  if (!/^[1-9]\d{0,5}$/.test(s)) return null;
  return Number(s);
}

/** True for an https URL on one of LIBRARY_HOSTS, with no credentials or odd port. */
export function libraryUrlOk(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password && !u.port && (LIBRARY_HOSTS as readonly string[]).includes(u.hostname);
  } catch {
    return false;
  }
}

/** Where a book's plain text lives. Only ever built from a number checked by bookIdOf. */
export const gutenbergTextUrl = (id: number) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
/** The book's page on gutenberg.org, for "open on Gutenberg" and the licence. */
export const gutenbergPageUrl = (id: number) => `https://www.gutenberg.org/ebooks/${id}`;
/** Project Gutenberg's licence, for the "Lisensi Project Gutenberg" link. */
export const GUTENBERG_LICENSE_URL = "https://www.gutenberg.org/policy/license.html";

/** A search query: trimmed, no control characters, at most 80 characters. Empty means "popular". */
export function libraryQuery(raw: unknown): string | null {
  if (raw == null) return "";
  if (typeof raw !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const q = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return q.length > 80 ? null : q;
}

/** The Gutendex URL for a search. Empty query: the most downloaded books. */
export function gutendexSearchUrl(q: string, page = 1) {
  const p = new URLSearchParams({ copyright: "false", mime_type: "text/plain" });
  if (q) p.set("search", q);
  if (page > 1) p.set("page", String(page));
  return `https://gutendex.com/books/?${p}`;
}

/** Project Gutenberg's own search (OPDS, an Atom feed), used when Gutendex is slow or down. Empty
 *  query: the most downloaded books. Pages hold 25 entries. */
export function gutenbergOpdsSearchUrl(q: string, page = 1) {
  const p = new URLSearchParams();
  if (q) p.set("query", q);
  else p.set("sort_order", "downloads");
  if (page > 1) p.set("start_index", String((page - 1) * 25 + 1));
  return `https://www.gutenberg.org/ebooks/search.opds/?${p}`;
}

/** A book's cover on gutenberg.org. Only ever built from a checked book number. */
export const gutenbergCoverUrl = (id: number) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** XML text to plain text: tags dropped, entities decoded, spaces collapsed. */
function xmlText(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

const tag = (entry: string, name: string) => new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(entry)?.[1];

/** Project Gutenberg's OPDS search feed, in the same shape as libraryHits. Only entries that are a
 *  book (their id or link is /ebooks/<number>) count; the sort links, authors and subjects that the
 *  feed also lists are skipped. Strings are capped like libraryHits. */
export function opdsHits(xml: string): { count: number; more: boolean; results: LibraryHit[] } {
  const results: LibraryHit[] = [];
  const seen = new Set<number>();
  const entries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const e of entries.slice(0, 60)) {
    const ref = `${tag(e, "id") ?? ""} ${(/<link[^>]*rel="(?:subsection|alternate)"[^>]*>/i.exec(e) ?? [""])[0]}`;
    const m = /(?:gutenberg\.org|["\s])\/ebooks\/(\d{1,6})(?:\.opds)?(?=["\s<]|$)/.exec(ref) ?? /\/ebooks\/(\d{1,6})(?:\.opds)?\s*$/.exec(tag(e, "id") ?? "");
    const id = bookIdOf(m?.[1]);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    const author = xmlText(tag(tag(e, "author") ?? "", "name") ?? tag(e, "content") ?? "");
    results.push({
      id,
      title: xmlText(tag(e, "title") ?? "").slice(0, 200) || `Buku #${id}`,
      // The content line is the author, sometimes followed by a download count: keep the name only.
      authors: author && !/^\d[\d,.]* downloads?$/i.test(author) ? [author.replace(/\s*\d[\d,.]* downloads?$/i, "").slice(0, 100)] : [],
      languages: [],
      cover: gutenbergCoverUrl(id),
      downloads: 0,
    });
    if (results.length >= 40) break;
  }
  return { count: results.length, more: /<link[^>]*rel="next"/i.test(xml), results };
}

/** One search result, as the reader shows it. */
export interface LibraryHit {
  id: number;
  title: string;
  authors: string[];
  languages: string[];
  /** Cover picture on gutenberg.org, when Gutendex lists one. */
  cover?: string;
  downloads: number;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Gutendex's answer, trimmed to what we show: only public-domain books with a plain-text edition,
 *  covers only from gutenberg.org, every string capped. Anything malformed is dropped. */
export function libraryHits(json: unknown): { count: number; more: boolean; results: LibraryHit[] } {
  const j = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const raw = Array.isArray(j.results) ? j.results : [];
  const results: LibraryHit[] = [];
  for (const r of raw.slice(0, 40)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = bookIdOf(o.id);
    if (id == null || o.copyright === true) continue;
    const formats = (o.formats && typeof o.formats === "object" ? o.formats : {}) as Record<string, unknown>;
    if (!Object.keys(formats).some((k) => k.startsWith("text/plain"))) continue;
    const cover = typeof formats["image/jpeg"] === "string" && libraryUrlOk(formats["image/jpeg"]) ? formats["image/jpeg"] : undefined;
    results.push({
      id,
      title: str(o.title, 200) || `Buku #${id}`,
      authors: (Array.isArray(o.authors) ? o.authors : [])
        .map((a) => str((a as Record<string, unknown> | null)?.name, 100))
        .filter(Boolean)
        .slice(0, 4),
      languages: (Array.isArray(o.languages) ? o.languages : []).filter((l): l is string => typeof l === "string" && /^[a-z]{2,3}$/.test(l)).slice(0, 4),
      ...(cover ? { cover } : {}),
      downloads: typeof o.download_count === "number" && o.download_count >= 0 ? Math.floor(o.download_count) : 0,
    });
  }
  return { count: typeof j.count === "number" ? j.count : results.length, more: typeof j.next === "string" && j.next.length > 0, results };
}

// --- The book text.

export interface LibraryBook {
  id: number;
  title: string;
  author: string;
  language: string;
  /** The book, paragraph by paragraph. A paragraph keeps its line breaks when it is verse or a list. */
  paragraphs: string[];
  /** Project Gutenberg's header and licence, kept with the text as the licence asks. */
  licence: string;
}

const START = /^\s*\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG E-?BOOK[^\n]*$/im;
const END = /^\s*\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG E-?BOOK[^\n]*$/im;
// Older files end with a line like this, or with "*END*THE SMALL PRINT!" before the text starts.
const OLD_END = /^\s*End of (?:the )?Project Gutenberg'?s? .*$/im;
const OLD_START = /^\s*\*END\*THE SMALL PRINT![^\n]*$/im;

/** A "Name: value" line from Gutenberg's header, such as Title, Author or Language. */
export const gutenbergField = (head: string, name: string) => new RegExp(`^${name}:\\s*(.+)$`, "im").exec(head)?.[1]?.trim().slice(0, 200) ?? "";

/** Split a Project Gutenberg plain-text file into the book itself and the Gutenberg header and
 *  licence around it. Title, author and language come from the header. */
export function splitGutenberg(raw: string, id: number): LibraryBook {
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const start = START.exec(text) ?? OLD_START.exec(text);
  const from = start ? start.index + start[0].length : 0;
  const rest = text.slice(from);
  const end = END.exec(rest) ?? OLD_END.exec(rest);
  const body = end ? rest.slice(0, end.index) : rest;
  const head = text.slice(0, start ? start.index : 0);
  const foot = end ? rest.slice(end.index) : "";
  const paragraphs = toParagraphs(body);
  // "Produced by ..." credits right after the start line are part of Gutenberg's notes, not the book.
  while (paragraphs.length && /^(produced by|e-?text prepared by|transcribed from|this e-?book was produced by)/i.test(paragraphs[0]!)) paragraphs.shift();
  return {
    id,
    title: gutenbergField(head, "Title") || `Buku #${id}`,
    author: gutenbergField(head, "Author"),
    language: gutenbergField(head, "Language"),
    paragraphs,
    licence: `${head.trim()}\n\n${foot.trim()}`.trim(),
  };
}

/** Text to paragraphs. Prose is wrapped at about 70 characters in the files: those lines are joined
 *  again. Short lines (poems, lists, tables of contents) keep their breaks. */
export function toParagraphs(body: string): string[] {
  return body
    .split(/\n[ \t]*\n+/)
    .map((p) => p.replace(/[ \t]+$/gm, "").replace(/^\n+|\n+$/g, ""))
    .filter((p) => p.trim())
    .map((p) => {
      const lines = p.split("\n");
      const prose = lines.length > 1 && lines.slice(0, -1).every((l) => l.trim().length >= 55 && !/^\s{2,}/.test(l));
      return prose ? lines.map((l) => l.trim()).join(" ") : lines.length === 1 ? p.trim() : p;
    });
}

/** Pages of about `perPage` characters, whole paragraphs where they fit; a long paragraph is cut at
 *  a sentence end or a space. `starts` is each page's first character, counted over the paragraphs,
 *  so a saved place survives a change of font size. */
export function paginate(paragraphs: string[], perPage: number): { pages: string[][]; starts: number[] } {
  const size = Math.max(200, Math.floor(perPage));
  const pages: string[][] = [];
  const starts: number[] = [];
  let page: string[] = [];
  let used = 0;
  let pos = 0;
  let pageStart = 0;
  const flush = () => {
    if (!page.length) return;
    pages.push(page);
    starts.push(pageStart);
    page = [];
    used = 0;
    pageStart = pos;
  };
  for (const para of paragraphs) {
    let rest = para;
    while (rest) {
      const room = size - used;
      if (rest.length <= room) {
        page.push(rest);
        used += rest.length;
        pos += rest.length;
        rest = "";
        break;
      }
      // Rather start a new page than leave a short stub of this paragraph at the bottom.
      if (used > 0 && room < size * 0.25) {
        flush();
        continue;
      }
      const cut = cutAt(rest, room);
      page.push(rest.slice(0, cut).trimEnd());
      pos += cut;
      rest = rest.slice(cut).trimStart();
      flush();
    }
    if (used >= size) flush();
  }
  flush();
  if (!pages.length) return { pages: [[""]], starts: [0] };
  return { pages, starts };
}

/** Where to cut a long paragraph within `max` characters: after a sentence, else at a space. */
function cutAt(s: string, max: number) {
  const part = s.slice(0, max);
  const sentence = Math.max(part.lastIndexOf(". "), part.lastIndexOf("! "), part.lastIndexOf("? "), part.lastIndexOf("\n"));
  if (sentence > max * 0.5) return sentence + 1;
  const space = part.lastIndexOf(" ");
  return space > max * 0.3 ? space + 1 : max;
}

/** The page holding character `pos`, from paginate's `starts`. */
export function pageAtPos(starts: number[], pos: number) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (starts[mid]! <= pos) lo = mid;
    else hi = mid - 1;
  }
  return Math.max(0, lo);
}
