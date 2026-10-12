import { NextResponse } from "next/server";
import { stateInlineMax } from "@/lib/limits";
import { decodeImage, knownMedia, publicState } from "@/lib/state-view";

export const dynamic = "force-dynamic";

const HASH = /^[a-f0-9]{32}$/;

/** One rebuild at a time per instance, and not more often than this, however many pictures miss at once. */
const REBUILD_MS = 5_000;
let rebuilt: { at: number; done: Promise<unknown> } | null = null;
function rebuild() {
  if (!rebuilt || Date.now() - rebuilt.at > REBUILD_MS) rebuilt = { at: Date.now(), done: publicState(stateInlineMax()).catch(() => undefined) };
  return rebuilt.done;
}

/**
 * A picture of the public setup by its content's hash (see extractMedia). Only pictures the public
 * setup shows are here, never an invoice or anything private. Named by content, so it never changes:
 * the browser and the CDN keep it for a year.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!HASH.test(hash)) return new NextResponse(null, { status: 404 });
  let url = knownMedia(hash);
  if (!url) {
    // Another instance built the setup that named it: read it here too.
    await rebuild();
    url = knownMedia(hash);
  }
  const img = url ? decodeImage(url) : null;
  if (!img) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, max-age=0, s-maxage=30" } });
  return new NextResponse(new Uint8Array(img.bytes), {
    headers: {
      "Content-Type": img.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
