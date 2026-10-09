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
