import { NextResponse, type NextRequest } from "next/server";
import { PREVIEW_COOKIE, launched, validPreview } from "./lib/preview";

// What anyone may load from the app before launch: what installing it and the coming-soon page need.
const OPEN = /^\/play\/(manifest\.webmanifest|icons\/|brand\/)/;

/** Before launch, jobfair.co.id shows the coming-soon page and the app is only for those with a pass. */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (launched()) return pathname === "/" ? NextResponse.redirect(new URL("/play/", req.url)) : NextResponse.next();
  if (pathname === "/" || OPEN.test(pathname)) return NextResponse.next();
  if (await validPreview(req.cookies.get(PREVIEW_COOKIE)?.value)) return NextResponse.next();
  return NextResponse.redirect(new URL("/", req.url));
}

export const config = { matcher: ["/", "/play", "/play/:path*"] };
