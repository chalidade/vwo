// Live site: job seekers who pre-registered for an event (jobfair.co.id/daftar/<slug>) before launch.
// Signing in with that Google email links the sign-up to the account on the server and fills the
// empty parts of the profile; here the game says so once, and the bag lists the events joined.
import type { Account } from "./account";
import { LIVE } from "./mode";
import { refreshPlayer } from "./player-sync";

/** An event this account joined by pre-registering. */
export interface JoinedEvent {
  code: string;
  name: string;
  slug: string;
  date: string;
  location: string;
}

export async function loadJoinedEvents(): Promise<{ events: JoinedEvent[]; welcome: JoinedEvent[] } | null> {
  try {
    const r = await fetch("/api/jobfair/prereg", { credentials: "same-origin" });
    return r.ok ? ((await r.json()) as { events: JoinedEvent[]; welcome: JoinedEvent[] }) : null;
  } catch {
    return null;
  }
}

const post = (body: unknown) =>
  fetch("/api/jobfair/prereg", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/**
 * The one-time welcome: "Data pra-registrasi kamu sudah terpasang", once per newly linked sign-up.
 * The profile was filled on the server already; a pull brings it to this device.
 */
let asked: string | null = null;

export async function preregWelcome(account: Account | null): Promise<string | null> {
  // Asked once per account per page load: signing in fires more than one account event.
  const who = account?.id ?? account?.email ?? "";
  if (!LIVE || !account || asked === who) return null;
  asked = who;
  const d = await loadJoinedEvents();
  if (!d?.welcome.length) return null;
  await post({ action: "seen" }).catch(() => undefined);
  refreshPlayer();
  const names = d.welcome.map((e) => e.name).join(", ");
  return `✅ Data pra-registrasi kamu sudah terpasang (${names}). Profilmu sudah terisi, cek di 🎒 Tas.`;
}

/** "Punya kode?": link a sign-up made with this account's own email. */
export async function claimPreregCode(code: string): Promise<{ ok: true; events: JoinedEvent[] } | { ok: false; error: string }> {
  try {
    const r = await post({ action: "claim", code });
    const d = (await r.json().catch(() => ({}))) as { events?: JoinedEvent[]; error?: string };
    if (!r.ok || !d.events) return { ok: false, error: d.error ?? `http_${r.status}` };
    refreshPlayer();
    return { ok: true, events: d.events };
  } catch {
    return { ok: false, error: "offline" };
  }
}
