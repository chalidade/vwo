import { NextResponse } from "next/server";
import { publicCache } from "@/lib/limits";
import { runtimeConfig } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

/** The server's limits for the game in the browser: the same for everyone, no secrets, kept by the CDN a minute. */
export async function GET() {
  return NextResponse.json(runtimeConfig(), { headers: { "Cache-Control": publicCache(60, 300) } });
}
