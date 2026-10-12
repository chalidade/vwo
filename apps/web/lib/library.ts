import "server-only";
import {
  gutenbergOpdsSearchUrl,
  gutenbergTextUrl,
  gutendexSearchUrl,
  LIBRARY_SEARCH_MAX,
  LIBRARY_TEXT_MAX,
  type LibraryBook,
  libraryHits,
  libraryUrlOk,
  opdsHits,
  splitGutenberg,
} from "@vwo/shared";

// The Perpustakaan's upstream: Project Gutenberg texts, and searches on Gutendex with Project
// Gutenberg's own OPDS search as the fallback, fetched one at a time
// on demand and kept for a day (here, and by the CDN in front). Every fetch, and every redirect it
// follows, must stay on the allowlisted hosts; answers are size-capped and time-limited.

/** Why a fetch failed: the route turns these into 404 / 413 / 502. */
export class LibraryError extends Error {
  constructor(readonly code: "not_found" | "too_large" | "upstream") {
    super(code);
  }
}

const TIMEOUT_MS = 10_000;
/** Gutendex is sometimes slow: it gets longer before we give up and ask Gutenberg's own search. */
const GUTENDEX_TIMEOUT_MS = 15_000;
/** After Gutendex failed, go straight to the fallback for a while instead of waiting on it again. */
const GUTENDEX_PAUSE_MS = 5 * 60_000;
const DAY_MS = 86_400_000;
/** Who is asking, so Project Gutenberg can tell us apart. */
const UA = "jobfair.co.id-perpustakaan/1.0 (+https://jobfair.co.id)";

/** A small in-memory cache: the newest `max` entries for a day. Each server instance has its own. */
class Memo<T> {
  private map = new Map<string, { at: number; value: T }>();
  constructor(private max: number) {}
  get(key: string) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > DAY_MS) {
      this.map.delete(key);
      return undefined;
    }
    // Most recently used goes to the back.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }
  set(key: string, value: T) {
    this.map.delete(key);
    this.map.set(key, { at: Date.now(), value });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
  }
  clear() {
    this.map.clear();
  }
}

const books = new Memo<LibraryBook>(30);
const searches = new Memo<ReturnType<typeof libraryHits>>(200);

/** For tests: forget everything cached. */
export function clearLibraryCache() {
  books.clear();
  searches.clear();
  gutendexDownUntil = 0;
}

/** GET an allowlisted URL as text, following at most three redirects that stay on the allowlist,
 *  refusing anything over `max` bytes. */
export async function fetchCapped(url: string, max: number, timeoutMs = TIMEOUT_MS): Promise<string> {
  let at = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!libraryUrlOk(at)) throw new LibraryError("upstream");
    let res: Response;
    try {
      res = await fetch(at, {
        redirect: "manual",
        headers: { "User-Agent": UA, Accept: "text/plain, application/json, application/atom+xml" },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch {
      throw new LibraryError("upstream");
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      await res.body?.cancel().catch(() => undefined);
      if (!next) throw new LibraryError("upstream");
      at = new URL(next, at).toString();
      continue;
    }
    if (res.status === 404) throw new LibraryError("not_found");
    if (!res.ok || !res.body) throw new LibraryError("upstream");
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > max) {
      await res.body.cancel().catch(() => undefined);
      throw new LibraryError("too_large");
    }
    // Read it ourselves, so a missing or false Content-Length cannot slip past the cap.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let got = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        got += value.byteLength;
        if (got > max) {
          await reader.cancel().catch(() => undefined);
          throw new LibraryError("too_large");
        }
        chunks.push(value);
      }
    } catch (e) {
      throw e instanceof LibraryError ? e : new LibraryError("upstream");
    }
    const all = new Uint8Array(got);
    let off = 0;
    for (const c of chunks) {
      all.set(c, off);
      off += c.byteLength;
    }
    return new TextDecoder("utf-8").decode(all);
  }
  throw new LibraryError("upstream");
}

/** One book's text, without Gutenberg's header and footer (kept apart as the licence). */
export async function loadBook(id: number): Promise<LibraryBook> {
  const key = String(id);
  const hit = books.get(key);
  if (hit) return hit;
  const text = await fetchCapped(gutenbergTextUrl(id), LIBRARY_TEXT_MAX);
  const book = splitGutenberg(text, id);
  if (!book.paragraphs.length) throw new LibraryError("not_found");
  books.set(key, book);
  return book;
}

let gutendexDownUntil = 0;

/** A search of public-domain plain-text books (empty: the most downloaded). Gutendex first; when it
 *  is slow, down or answers nonsense, Project Gutenberg's own OPDS search on the same allowlist.
 *  Throws LibraryError("upstream") only when both fail. */
export async function searchBooks(q: string, page: number) {
  const key = `${page}:${q.toLowerCase()}`;
  const hit = searches.get(key);
  if (hit) return hit;
  let out: ReturnType<typeof libraryHits> | null = null;
  if (Date.now() >= gutendexDownUntil) {
    try {
      const text = await fetchCapped(gutendexSearchUrl(q, page), LIBRARY_SEARCH_MAX, GUTENDEX_TIMEOUT_MS);
      out = libraryHits(JSON.parse(text));
    } catch {
      gutendexDownUntil = Date.now() + GUTENDEX_PAUSE_MS;
    }
  }
  if (!out) {
    try {
      const xml = await fetchCapped(gutenbergOpdsSearchUrl(q, page), LIBRARY_SEARCH_MAX);
      // A block or error page is not "no results": only a real Atom feed counts.
      if (!/<feed[\s>]/.test(xml)) throw new LibraryError("upstream");
      out = opdsHits(xml);
    } catch {
      throw new LibraryError("upstream");
    }
  }
  searches.set(key, out);
  return out;
}

/** Cache headers for a good answer: the CDN keeps it a day, browsers an hour. */
export const LIBRARY_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
