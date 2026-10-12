// The Perpustakaan routes with upstream faked: only book numbers get through, only allowlisted hosts
// are ever fetched (redirects included), big or slow answers are refused, and good answers are cached.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ allowed: true, throws: false }));
vi.mock("@/lib/ratelimit", () => ({
  allow: async () => {
    if (state.throws) throw new Error("db down");
    return state.allowed;
  },
}));

const { GET: getBook } = await import("../app/api/library/books/[id]/route");
const { GET: search } = await import("../app/api/library/search/route");
const { GET: getImage } = await import("../app/api/library/books/[id]/img/[file]/route");
const { clearLibraryCache, fetchCapped } = await import("../lib/library");

const TEXT = [
  "Title: Test Book",
  "Author: Someone",
  "Language: English",
  "*** START OF THE PROJECT GUTENBERG EBOOK TEST ***",
  "",
  "Chapter one.",
  "",
  "*** END OF THE PROJECT GUTENBERG EBOOK TEST ***",
  "Full licence here.",
].join("\n");
const HTML = readFileSync(new URL("./fixtures/gutenberg-book.html", import.meta.url), "utf8");
/** No HTML edition: Gutenberg answers 404 for it, so the plain text is used. */
const textOnly = (body: () => Response) => (url: string) => (url.endsWith("-images.html") ? new Response("Not found", { status: 404 }) : body());

let fetched: string[];
let reply: (url: string) => Response;
const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const url = String(input instanceof Request ? input.url : input);
  fetched.push(url);
  return reply(url);
});

beforeEach(() => {
  fetched = [];
  state.allowed = true;
  state.throws = false;
  clearLibraryCache();
  reply = textOnly(() => new Response(TEXT, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const book = (id: string) => getBook(new Request(`https://jobfair.co.id/api/library/books/${encodeURIComponent(id)}`), { params: Promise.resolve({ id }) });

describe("GET /api/library/books/[id]", () => {
  it("rejects anything but a book number, without fetching", async () => {
    for (const id of ["abc", "0", "12a", "../../etc/passwd", "https://evil.example/x", "1234567", "-5", ""]) {
      const res = await book(id);
      expect(res.status).toBe(400);
    }
    expect(fetched).toEqual([]);
  });

  it("reads the HTML edition first: cleaned, with its chapters and pictures, and the licence kept", async () => {
    reply = () => new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    const res = await book("4507");
    expect(res.status).toBe(200);
    expect(fetched).toEqual(["https://www.gutenberg.org/cache/epub/4507/pg4507-images.html"]);
    expect(res.headers.get("cache-control")).toMatch(/public.*s-maxage=86400/);
    const d = (await res.json()) as { format: string; title: string; author: string; blocks: unknown[]; licence: string; paragraphs?: unknown };
    expect(d).toMatchObject({ format: "html", title: "The Test Book", author: "Jane Tester" });
    expect(d.paragraphs).toBeUndefined();
    expect(d.blocks).toContainEqual({ t: "img", src: "i_002.png", alt: "The storm" });
    expect(JSON.stringify(d.blocks)).not.toMatch(/alert|script|evil/);
    expect(d.licence).toContain("Full licence here.");
    expect((await book("4507")).status).toBe(200);
    expect(fetched.length).toBe(1);
  });

  it("falls back to the plain text when the HTML edition is missing, too big or empty", async () => {
    for (const html of [() => new Response("x", { headers: { "content-length": "7000000" } }), () => new Response("<html><body><p>Oops</p></body></html>")]) {
      clearLibraryCache();
      fetched = [];
      reply = (url) => (url.endsWith(".html") ? html() : new Response(TEXT));
      const d = (await (await book("4507")).json()) as { format: string; blocks: unknown[] };
      expect(d.format).toBe("text");
      expect(d.blocks).toEqual([{ t: "h2", c: ["Chapter one."] }]);
      expect(fetched).toEqual(["https://www.gutenberg.org/cache/epub/4507/pg4507-images.html", "https://www.gutenberg.org/cache/epub/4507/pg4507.txt"]);
    }
  });

  it("fetches only gutenberg.org for that number, strips the boilerplate, keeps the licence, caches", async () => {
    const res = await book("4507");
    expect(res.status).toBe(200);
    expect(fetched).toEqual(["https://www.gutenberg.org/cache/epub/4507/pg4507-images.html", "https://www.gutenberg.org/cache/epub/4507/pg4507.txt"]);
    expect(res.headers.get("cache-control")).toMatch(/public.*s-maxage=86400/);
    const d = (await res.json()) as { title: string; format: string; blocks: unknown[]; licence: string; licenceUrl: string; source: string };
    expect(d.title).toBe("Test Book");
    expect(d.format).toBe("text");
    expect(d.blocks).toEqual([{ t: "h2", c: ["Chapter one."] }]);
    expect(d.licence).toContain("Full licence here.");
    expect(d.licenceUrl).toBe("https://www.gutenberg.org/policy/license.html");
    expect(d.source).toBe("https://www.gutenberg.org/ebooks/4507");
    // Second time: from memory, no new fetch.
    expect((await book("4507")).status).toBe(200);
    expect(fetched.length).toBe(2);
  });

  it("follows a redirect on the allowlist, but never one to another host", async () => {
    const text = textOnly(() => new Response(TEXT));
    reply = (url) =>
      url.endsWith(".txt") && url.includes("/cache/") ? new Response(null, { status: 302, headers: { location: "https://gutenberg.org/files/7/7.txt" } }) : text(url);
    expect((await book("7")).status).toBe(200);
    expect(fetched).toEqual(["https://www.gutenberg.org/cache/epub/7/pg7-images.html", "https://www.gutenberg.org/cache/epub/7/pg7.txt", "https://gutenberg.org/files/7/7.txt"]);
    fetched = [];
    reply = () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
    const res = await book("8");
    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fetched).toEqual(["https://www.gutenberg.org/cache/epub/8/pg8-images.html", "https://www.gutenberg.org/cache/epub/8/pg8.txt"]);
  });

  it("refuses texts over the size cap, even without a Content-Length", async () => {
    const big = "x".repeat(3_000_001);
    reply = textOnly(() => new Response(new Blob([big]).stream()));
    expect((await book("9")).status).toBe(413);
    reply = textOnly(() => new Response("x", { headers: { "content-length": "4000000" } }));
    expect((await book("10")).status).toBe(413);
  });

  it("answers offline and missing books gracefully", async () => {
    reply = () => {
      throw new TypeError("fetch failed");
    };
    const res = await book("11");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "upstream" });
    reply = () => new Response("Not found", { status: 404 });
    expect((await book("12")).status).toBe(404);
  });

  it("is rate limited per address", async () => {
    state.allowed = false;
    expect((await book("4507")).status).toBe(429);
    expect(fetched).toEqual([]);
  });
});

describe("GET /api/library/books/[id]/img/[file]", () => {
  const img = (id: string, file: string) =>
    getImage(new Request(`https://jobfair.co.id/api/library/books/${id}/img/${encodeURIComponent(file)}`), { params: Promise.resolve({ id, file }) });
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

  it("rejects anything but a bare jpg, png or gif name, without fetching", async () => {
    for (const file of ["../secret.jpg", "a/b.jpg", "x.svg", "x.html", "x.jpg?y=1", ".jpg", "x.JPG.exe", "%2e%2e.jpg", `${"a".repeat(81)}.jpg`, ""])
      expect((await img("4507", file)).status, file).toBe(400);
    expect((await img("abc", "a.jpg")).status).toBe(400);
    expect(fetched).toEqual([]);
  });

  it("fetches the book's own picture and answers with a type of its own, not to be sniffed, cached", async () => {
    reply = () => new Response(PNG, { headers: { "content-type": "image/png" } });
    const res = await img("4507", "i_002.png");
    expect(res.status).toBe(200);
    expect(fetched).toEqual(["https://www.gutenberg.org/cache/epub/4507/images/i_002.png"]);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toMatch(/public/);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
  });

  it("refuses what upstream does not call an image, and pictures over the cap", async () => {
    reply = () => new Response("<script>alert(1)</script>", { headers: { "content-type": "text/html" } });
    expect((await img("4507", "a.jpg")).status).toBe(502);
    reply = () => new Response(new Blob([new Uint8Array(2_000_001)]).stream(), { headers: { "content-type": "image/jpeg" } });
    expect((await img("4507", "b.jpg")).status).toBe(413);
    reply = () => new Response("nope", { status: 404 });
    expect((await img("4507", "c.gif")).status).toBe(404);
  });

  it("is rate limited per address", async () => {
    state.allowed = false;
    expect((await img("4507", "a.jpg")).status).toBe(429);
    expect(fetched).toEqual([]);
  });
});

describe("GET /api/library/search", () => {
  const gutendex = {
    count: 1,
    next: null,
    results: [
      { id: 1342, title: "Pride and Prejudice", authors: [{ name: "Austen, Jane" }], languages: ["en"], copyright: false, formats: { "text/plain": "x" }, download_count: 9 },
    ],
  };

  it("searches Gutendex with the query encoded, and caches", async () => {
    reply = () => Response.json(gutendex);
    const res = await search(new Request("https://jobfair.co.id/api/library/search?q=pride%26languages%3Dfr"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(/s-maxage=86400/);
    const u = new URL(fetched[0]!);
    expect(u.host).toBe("gutendex.com");
    expect(u.searchParams.get("search")).toBe("pride&languages=fr");
    expect(u.searchParams.get("languages")).toBeNull();
    expect(((await res.json()) as { results: { id: number }[] }).results.map((r) => r.id)).toEqual([1342]);
  });

  it("rejects long queries and bad pages without fetching", async () => {
    expect((await search(new Request(`https://jobfair.co.id/api/library/search?q=${"x".repeat(81)}`))).status).toBe(400);
    for (const p of ["0", "21", "abc", "1.5"]) expect((await search(new Request(`https://jobfair.co.id/api/library/search?page=${p}`))).status).toBe(400);
    expect(fetched).toEqual([]);
  });

  const OPDS = readFileSync(new URL("../../../packages/shared/test/fixtures/gutenberg-search.opds.xml", import.meta.url), "utf8");
  const atom = () => new Response(OPDS, { headers: { "content-type": "application/atom+xml" } });
  const ids = async (res: Response) => ((await res.json()) as { results: { id: number }[] }).results.map((r) => r.id);

  it("falls back to Gutenberg's own search when Gutendex errors", async () => {
    reply = (url) => (url.startsWith("https://gutendex.com/") ? new Response("busy", { status: 503 }) : atom());
    const res = await search(new Request("https://jobfair.co.id/api/library/search?q=sherlock"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(/s-maxage=86400/);
    expect(await ids(res)).toEqual([1661, 2852, 244]);
    expect(fetched.map((u) => new URL(u).host)).toEqual(["gutendex.com", "www.gutenberg.org"]);
    expect(new URL(fetched[1]!).searchParams.get("query")).toBe("sherlock");
  });

  it("falls back on a Gutendex timeout or junk, then skips Gutendex for a while", async () => {
    reply = (url) => {
      if (url.startsWith("https://gutendex.com/")) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      return atom();
    };
    expect((await search(new Request("https://jobfair.co.id/api/library/search?q=holmes"))).status).toBe(200);
    fetched = [];
    // The next search goes straight to Gutenberg.
    expect((await search(new Request("https://jobfair.co.id/api/library/search?q=watson"))).status).toBe(200);
    expect(fetched.map((u) => new URL(u).host)).toEqual(["www.gutenberg.org"]);
    clearLibraryCache();
    fetched = [];
    reply = (url) => (url.startsWith("https://gutendex.com/") ? new Response("<html>oops</html>") : atom());
    expect(await ids(await search(new Request("https://jobfair.co.id/api/library/search?q=pride")))).toEqual([1661, 2852, 244]);
  });

  it("uses the fallback for the popular row too, sorted by downloads", async () => {
    reply = (url) => (url.startsWith("https://gutendex.com/") ? new Response("x", { status: 500 }) : atom());
    expect((await search(new Request("https://jobfair.co.id/api/library/search"))).status).toBe(200);
    expect(new URL(fetched[1]!).searchParams.get("sort_order")).toBe("downloads");
  });

  it("answers a clean 503 when both sources fail, and caches nothing", async () => {
    for (const second of [
      () => new Response("down", { status: 502 }),
      () => new Response("<html>blocked</html>"),
      () => new Response(null, { status: 302, headers: { location: "https://evil.example/feed" } }),
    ]) {
      clearLibraryCache();
      fetched = [];
      reply = (url) => (url.startsWith("https://gutendex.com/") ? new Response("x", { status: 500 }) : second());
      const res = await search(new Request("https://jobfair.co.id/api/library/search?q=sherlock"));
      expect(res.status).toBe(503);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toEqual({ error: "search_unavailable" });
      expect(fetched.every((u) => ["gutendex.com", "www.gutenberg.org"].includes(new URL(u).host))).toBe(true);
    }
    // Back up: the next try works, nothing bad was cached.
    reply = () => Response.json({ count: 0, next: null, results: [] });
    clearLibraryCache();
    expect((await search(new Request("https://jobfair.co.id/api/library/search?q=sherlock"))).status).toBe(200);
  });

  it("refuses an oversized fallback feed", async () => {
    reply = (url) => (url.startsWith("https://gutendex.com/") ? new Response("x", { status: 500 }) : new Response(new Blob(["<feed>", "x".repeat(1_000_001)]).stream()));
    expect((await search(new Request("https://jobfair.co.id/api/library/search?q=big"))).status).toBe(503);
  });

  it("does not crash when the rate limiter itself fails", async () => {
    state.throws = true;
    const res = await search(new Request("https://jobfair.co.id/api/library/search?q=sherlock"));
    expect(res.status).toBe(503);
    expect(fetched).toEqual([]);
  });
});

describe("fetchCapped", () => {
  it("never fetches a host off the allowlist", async () => {
    await expect(fetchCapped("https://evil.example/x", 10)).rejects.toThrow("upstream");
    expect(fetched).toEqual([]);
  });
});
