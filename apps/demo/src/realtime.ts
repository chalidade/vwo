// One Supabase Realtime connection for the whole live app: player positions and call signals
// share it. Only the publishable key is used; every table stays locked (see migration 0003).
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE } from "./mode";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

export const hasRealtime = () => LIVE && !!URL_ && !!KEY;

let client: Promise<SupabaseClient | null> | null = null;

export function realtimeClient(): Promise<SupabaseClient | null> {
  if (!hasRealtime()) return Promise.resolve(null);
  client ??= import("@supabase/supabase-js").then(({ createClient }) => createClient(URL_!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } }));
  return client;
}

/** Channels still leaving, by topic. Supabase hands back the same channel object for a topic that
 *  is still open, and subscribing to one that is leaving never answers, so a rejoin waits for it. */
const leaving = new Map<string, Promise<unknown>>();

/** A channel for `topic` that can be subscribed now: waits for an earlier one of that name to finish leaving. */
export async function openChannel(sb: SupabaseClient, topic: string, opts: Parameters<SupabaseClient["channel"]>[1]) {
  await leaving.get(topic);
  return sb.channel(topic, opts);
}

/** Leave a channel for good, so the topic can be joined afresh later. */
export function closeChannel(sb: SupabaseClient, topic: string, ch: { unsubscribe(): Promise<unknown> }) {
  const done = sb.removeChannel(ch as Parameters<SupabaseClient["removeChannel"]>[0]).catch(() => undefined);
  leaving.set(topic, done);
  void done.then(() => leaving.get(topic) === done && leaving.delete(topic));
}
