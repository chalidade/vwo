import { bookIdOf, GUTENBERG_LICENSE_URL, gutenbergPageUrl } from "@vwo/shared";
import { NextResponse } from "next/server";
import { clientIp, fail } from "@/lib/http";
import { LIBRARY_CACHE, LibraryError, loadBook } from "@/lib/library";
import { allow } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * One public-domain book from Project Gutenberg, for the Perpustakaan's reader. The browser sends
 * only the book's number; the server builds the Gutenberg URL itself. Public, like the books: the
 * CDN keeps each book a day, and each address may ask upstream a limited number of times.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = bookIdOf((await params).id);
  if (id == null) return fail(400, "bad_id");
  try {
    if (!(await allow(`library:${clientIp(req)}`, 60, 600_000))) return fail(429, "too_many_requests");
    const book = await loadBook(id);
    return NextResponse.json({ ...book, source: gutenbergPageUrl(id), licenceUrl: GUTENBERG_LICENSE_URL }, { headers: { "Cache-Control": LIBRARY_CACHE } });
  } catch (e) {
    const code = e instanceof LibraryError ? e.code : "upstream";
    return NextResponse.json({ error: code }, { status: code === "not_found" ? 404 : code === "too_large" ? 413 : 502, headers: { "Cache-Control": "no-store" } });
  }
}
