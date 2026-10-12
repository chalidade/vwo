import { libraryQuery } from "@vwo/shared";
import { NextResponse } from "next/server";
import { clientIp, fail } from "@/lib/http";
import { LIBRARY_CACHE, LibraryError, searchBooks } from "@/lib/library";
import { allow } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Search Project Gutenberg's public-domain books by title or author (through Gutendex). Without a
 *  query: the most downloaded books. `page` runs from 1 to 20. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = libraryQuery(url.searchParams.get("q"));
  const pageRaw = url.searchParams.get("page") ?? "1";
  if (q == null) return fail(400, "bad_query");
  if (!/^\d{1,2}$/.test(pageRaw) || Number(pageRaw) < 1 || Number(pageRaw) > 20) return fail(400, "bad_page");
  if (!(await allow(`library:${clientIp(req)}`, 60, 600_000))) return fail(429, "too_many_requests");
  try {
    return NextResponse.json(await searchBooks(q, Number(pageRaw)), { headers: { "Cache-Control": LIBRARY_CACHE } });
  } catch (e) {
    const code = e instanceof LibraryError ? e.code : "upstream";
    return NextResponse.json({ error: code }, { status: code === "not_found" ? 404 : 502, headers: { "Cache-Control": "no-store" } });
  }
}
