import { NextResponse } from "next/server";
import { runtimeConfig } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

/** The game's runtime limits from env (no secrets), cached a minute so a crowd costs one call a minute per edge. */
export function GET() {
  return NextResponse.json(runtimeConfig(), { headers: { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" } });
}
