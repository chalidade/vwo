import { libraryQuery } from "@vwo/shared";
import { NextResponse } from "next/server";
import { clientIp, fail } from "@/lib/http";
import { LIBRARY_CACHE, searchBooks } from "@/lib/library";
import { allow } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
// Gutendex may take up to 15 s before the fallback search gets its 10 s.
export const maxDuration = 30;

/** Search Project Gutenberg's public-domain books by title or author (Gutendex, else Gutenberg's own
 *  search). Without a query: the most downloaded books. `page` runs from 1 to 20. When neither source
 *  answers, a 503 with `search_unavailable` that the reader shows in its own words, never a crash. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = libraryQuery(url.searchParams.get("q"));
  const pageRaw = url.searchParams.get("page") ?? "1";
  if (q == null) return fail(400, "bad_query");
  if (!/^\d{1,2}$/.test(pageRaw) || Number(pageRaw) < 1 || Number(pageRaw) > 20) return fail(400, "bad_page");
  try {
    if (!(await allow(`library:${clientIp(req)}`, 60, 600_000))) return fail(429, "too_many_requests");
    return NextResponse.json(await searchBooks(q, Number(pageRaw)), { headers: { "Cache-Control": LIBRARY_CACHE } });
  } catch {
    return NextResponse.json({ error: "search_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
