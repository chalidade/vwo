// The Perpustakaan routes with upstream faked: only book numbers get through, only allowlisted hosts
// are ever fetched (redirects included), big or slow answers are refused, and good answers are cached.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ allowed: true }));
vi.mock("@/lib/ratelimit", () => ({ allow: async () => state.allowed }));

const { GET: getBook } = await import("../app/api/library/books/[id]/route");
const { GET: search } = await import("../app/api/library/search/route");
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
  clearLibraryCache();
  reply = () => new Response(TEXT, { status: 200 });
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

  it("fetches only gutenberg.org for that number, strips the boilerplate, keeps the licence, caches", async () => {
    const res = await book("4507");
    expect(res.status).toBe(200);
    expect(fetched).toEqual(["https://www.gutenberg.org/cache/epub/4507/pg4507.txt"]);
    expect(res.headers.get("cache-control")).toMatch(/public.*s-maxage=86400/);
    const d = (await res.json()) as { title: string; paragraphs: string[]; licence: string; licenceUrl: string; source: string };
    expect(d.title).toBe("Test Book");
    expect(d.paragraphs).toEqual(["Chapter one."]);
    expect(d.licence).toContain("Full licence here.");
    expect(d.licenceUrl).toBe("https://www.gutenberg.org/policy/license.html");
    expect(d.source).toBe("https://www.gutenberg.org/ebooks/4507");
    // Second time: from memory, no new fetch.
    expect((await book("4507")).status).toBe(200);
    expect(fetched.length).toBe(1);
  });

  it("follows a redirect on the allowlist, but never one to another host", async () => {
    reply = (url) => (url.includes("/cache/") ? new Response(null, { status: 302, headers: { location: "https://gutenberg.org/files/7/7.txt" } }) : new Response(TEXT));
    expect((await book("7")).status).toBe(200);
    expect(fetched).toEqual(["https://www.gutenberg.org/cache/epub/7/pg7.txt", "https://gutenberg.org/files/7/7.txt"]);
    fetched = [];
    reply = () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
    const res = await book("8");
    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fetched).toEqual(["https://www.gutenberg.org/cache/epub/8/pg8.txt"]);
  });

  it("refuses texts over the size cap, even without a Content-Length", async () => {
    const big = "x".repeat(3_000_001);
    reply = () => new Response(new Blob([big]).stream());
    expect((await book("9")).status).toBe(413);
    reply = () => new Response("x", { headers: { "content-length": "4000000" } });
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

  it("returns 502 on broken JSON", async () => {
    reply = () => new Response("<html>", { status: 200 });
    expect((await search(new Request("https://jobfair.co.id/api/library/search"))).status).toBe(502);
  });
});

describe("fetchCapped", () => {
  it("never fetches a host off the allowlist", async () => {
    await expect(fetchCapped("https://evil.example/x", 10)).rejects.toThrow("upstream");
    expect(fetched).toEqual([]);
  });
});
