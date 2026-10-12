import "server-only";
import { gutenbergTextUrl, gutendexSearchUrl, LIBRARY_SEARCH_MAX, LIBRARY_TEXT_MAX, type LibraryBook, libraryHits, libraryUrlOk, splitGutenberg } from "@vwo/shared";

// The Perpustakaan's upstream: Project Gutenberg texts and Gutendex searches, fetched one at a time
// on demand and kept for a day (here, and by the CDN in front). Every fetch, and every redirect it
// follows, must stay on the allowlisted hosts; answers are size-capped and time-limited.

/** Why a fetch failed: the route turns these into 404 / 413 / 502. */
export class LibraryError extends Error {
  constructor(readonly code: "not_found" | "too_large" | "upstream") {
    super(code);
  }
}

const TIMEOUT_MS = 10_000;
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
}

/** GET an allowlisted URL as text, following at most three redirects that stay on the allowlist,
 *  refusing anything over `max` bytes. */
export async function fetchCapped(url: string, max: number): Promise<string> {
  let at = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!libraryUrlOk(at)) throw new LibraryError("upstream");
    let res: Response;
    try {
      res = await fetch(at, {
        redirect: "manual",
        headers: { "User-Agent": UA, Accept: "text/plain, application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
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

/** A Gutendex search (empty: the most downloaded books), public-domain plain-text books only. */
export async function searchBooks(q: string, page: number) {
  const url = gutendexSearchUrl(q, page);
  const hit = searches.get(url);
  if (hit) return hit;
  const text = await fetchCapped(url, LIBRARY_SEARCH_MAX);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new LibraryError("upstream");
  }
  const out = libraryHits(json);
  searches.set(url, out);
  return out;
}

/** Cache headers for a good answer: the CDN keeps it a day, browsers an hour. */
export const LIBRARY_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
