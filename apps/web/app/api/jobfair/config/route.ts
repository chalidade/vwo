import { NextResponse } from "next/server";
import { runtimeConfig } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

/** The game's runtime limits (public, the same for everyone): cached a minute at the CDN, so a crowd costs one function call a minute. */
export function GET() {
  return NextResponse.json(runtimeConfig(), { headers: { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" } });
}
