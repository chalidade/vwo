import { bookIdOf, bookImageOf } from "@vwo/shared";
import { NextResponse } from "next/server";
import { clientIp, fail } from "@/lib/http";
import { LibraryError, loadImage } from "@/lib/library";
import { allow } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * A picture from a book's HTML edition, for the Perpustakaan's reader. The browser sends the book's
 * number and a bare file name; the server builds the Gutenberg URL itself, takes only jpg, png and
 * gif under the size cap, and answers with a type of its own choosing that the browser may not sniff.
 * The CDN keeps each picture for a week.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const p = await params;
  const id = bookIdOf(p.id);
  const file = bookImageOf(p.file);
  if (id == null || file == null) return fail(400, "bad_image");
  try {
    // Pictures come many to a book: a bigger allowance than whole books, on its own counter.
    if (!(await allow(`library-img:${clientIp(req)}`, 300, 600_000))) return fail(429, "too_many_requests");
    const img = await loadImage(id, file);
    return new NextResponse(img.bytes as BodyInit, {
      headers: {
        "Content-Type": img.type,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    const code = e instanceof LibraryError ? e.code : "upstream";
    return NextResponse.json({ error: code }, { status: code === "not_found" ? 404 : code === "too_large" ? 413 : 502, headers: { "Cache-Control": "no-store" } });
  }
}
