import { NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type IceServer = { urls: string | string[]; username?: string; credential?: string };

/** How long relay credentials handed to a browser stay valid. */
const TTL = 6 * 60 * 60;

/**
 * Relay servers for calls and the stage broadcast. Two phones on different networks (mobile data,
 * office Wi-Fi) usually can't reach each other directly; a TURN relay carries the audio and video
 * between them. With Cloudflare's TURN service (TURN_KEY_ID and TURN_KEY_API_TOKEN), each signed-in
 * visitor gets short-lived credentials; a fixed relay (TURN_URL, TURN_USERNAME, TURN_CREDENTIAL)
 * works too. Without either, calls only connect where the two networks allow it.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`turn:${user.id}`, 60, 600_000))) return fail(429, "too_many_requests");
  const iceServers: IceServer[] = [];
  const keyId = process.env.TURN_KEY_ID;
  const token = process.env.TURN_KEY_API_TOKEN;
  if (keyId && token) {
    try {
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: TTL }),
        signal: AbortSignal.timeout(5_000),
      });
      if (r.ok) {
        const d = (await r.json()) as { iceServers?: IceServer[] | IceServer };
        iceServers.push(...(Array.isArray(d.iceServers) ? d.iceServers : d.iceServers ? [d.iceServers] : []));
      } else console.warn("turn credentials failed", r.status);
    } catch (e) {
      console.warn("turn credentials failed", (e as Error).message);
    }
  }
  const url = process.env.TURN_URL;
  if (url) iceServers.push({ urls: url.split(",").map((u) => u.trim()), username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  return NextResponse.json({ iceServers, ttl: TTL }, { headers: { "Cache-Control": "private, no-store" } });
}
