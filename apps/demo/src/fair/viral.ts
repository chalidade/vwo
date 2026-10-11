// What makes seekers bring their friends: an invite link that pays both sides, badges to show off,
// and a leaderboard where their campus competes with other campuses.
import { price } from "@vwo/shared";
import type { Account } from "../account";
import type { FairApplication, PlayerState } from "../jobfair-engine";
import { LIVE } from "../mode";
import { levelOf } from "./content";

const REF_KEY = "vwo:ref";
const REF_DAYS = 30;

/** The invite code from a link like /play/?ref=abc123 (or #/jobfair?ref=abc123), kept until it is used. */
export function captureRef(loc: Location = location) {
  const fromHash = new URLSearchParams(loc.hash.split("?")[1] ?? "");
  const code = (new URLSearchParams(loc.search).get("ref") ?? fromHash.get("ref") ?? "").trim().toLowerCase();
  if (!/^[0-9a-z]{6,16}$/.test(code)) return null;
  try {
    localStorage.setItem(REF_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    // Storage blocked: the code is just not remembered.
  }
  // Take it out of the address, so a shared screenshot or link of this page doesn't carry it on.
  const search = new URLSearchParams(loc.search);
  search.delete("ref");
  const hash = loc.hash.split("?")[0] ?? "";
  history.replaceState(null, "", `${loc.pathname}${search.size ? `?${search}` : ""}${hash}`);
  return code;
}

function storedRef() {
  try {
    const v = JSON.parse(localStorage.getItem(REF_KEY) ?? "null") as { code?: string; at?: number } | null;
    if (!v?.code || !v.at || Date.now() - v.at > REF_DAYS * 86_400_000) return null;
    return v.code;
  } catch {
    return null;
  }
}

function forgetRef() {
  try {
    localStorage.removeItem(REF_KEY);
  } catch {
    // Nothing to forget.
  }
}

/** Live site: once signed in, hand the friend's code to the server. Kept for later when the email still needs confirming. */
export async function claimStoredRef(account: Account | null): Promise<string | null> {
  const code = storedRef();
  if (!LIVE || !account || !code) return null;
  const r = await fetch("/api/jobfair/referral", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  }).catch(() => null);
  if (!r) return null;
  if (r.status === 409) {
    const e = (await r.json().catch(() => ({}))) as { error?: string };
    if (e.error === "verify_first") return null;
  }
  forgetRef();
  if (!r.ok) return null;
  const d = (await r.json()) as { reward: number };
  // Loaded here, not at the top, so the badge and campus helpers stay free of the game engine.
  void import("../coin-sync").then((m) => m.refreshCoins());
  return `Kamu dapat ${d.reward} koin bonus karena bergabung lewat ajakan teman.`;
}

export interface ReferralInfo {
  code: string;
  friends: number;
  coins: number;
  reward: number;
}

const DEMO_FRIENDS = "vwo:ref-friends";

/** This account's invite code and how many friends it brought. Demo: made up from the account. */
export async function loadReferral(account: Account | null): Promise<ReferralInfo | null> {
  if (!account) return null;
  if (LIVE) {
    const r = await fetch("/api/jobfair/referral", { credentials: "same-origin" }).catch(() => null);
    return r?.ok ? ((await r.json()) as ReferralInfo) : null;
  }
  let h = 0;
  for (const c of account.email) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  let friends = 0;
  try {
    friends = Number(localStorage.getItem(DEMO_FRIENDS) ?? 0) || 0;
  } catch {
    // Storage blocked.
  }
  const reward = price("coin.referral");
  return { code: h.toString(16).padStart(8, "0").slice(0, 12), friends, coins: friends * reward, reward };
}

export const inviteLink = (code: string) => `${location.origin}${LIVE ? "/play/" : location.pathname}?ref=${code}`;

export function inviteText(name: string, code: string, reward: number) {
  return `Aku lagi cari kerja di job fair virtual ${location.host}: ketemu recruiter, ikut seminar, dan melamar langsung dari HP. Daftar lewat link ini, kita sama-sama dapat ${reward} koin: ${inviteLink(code)}${name ? ` (dari ${name})` : ""}`;
}

export interface CampusRow {
  campus: string;
  members: number;
  xp: number;
}

const DEMO_CAMPUSES: CampusRow[] = [
  { campus: "Universitas Indonesia", members: 412, xp: 61_240 },
  { campus: "ITB", members: 388, xp: 58_910 },
  { campus: "UGM", members: 351, xp: 52_300 },
  { campus: "ITS", members: 240, xp: 37_800 },
  { campus: "Universitas Brawijaya", members: 198, xp: 29_450 },
  { campus: "Telkom University", members: 176, xp: 26_020 },
  { campus: "SMK Negeri 1 Surabaya", members: 92, xp: 11_870 },
];

export const campusKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Campuses by their students' total XP. Demo: a few made-up campuses plus the player's own. */
export async function loadCampusBoard(mine?: { campus: string; xp: number }): Promise<CampusRow[] | null> {
  if (LIVE) {
    const r = await fetch("/api/jobfair/campus").catch(() => null);
    return r?.ok ? ((await r.json()) as { top: CampusRow[] }).top : null;
  }
  const rows = DEMO_CAMPUSES.map((r) => ({ ...r }));
  if (mine?.campus.trim()) {
    const have = rows.find((r) => campusKey(r.campus) === campusKey(mine.campus));
    if (have) {
      have.members += 1;
      have.xp += mine.xp;
    } else rows.push({ campus: mine.campus.trim(), members: 1, xp: mine.xp });
  }
  return rows.sort((a, b) => b.xp - a.xp);
}

export interface Badge {
  id: string;
  icon: string;
  name: string;
  /** How to get it, shown on badges not earned yet. */
  how: string;
  got: boolean;
}

export interface BadgeInput {
  applications: FairApplication[];
  player: PlayerState;
  stamps: number;
  booths: number;
  psychPass: number;
  friends: number;
}

/** Every badge, earned ones first. */
export function badgesOf(i: BadgeInput): Badge[] {
  const apps = i.applications.length;
  const best = i.player.psych.reduce((m, r) => Math.max(m, r.total ? r.score / r.total : 0), 0);
  const list: Omit<Badge, "got">[] = [];
  const got = new Set<string>();
  const add = (id: string, icon: string, name: string, how: string, ok: boolean) => {
    list.push({ id, icon, name, how });
    if (ok) got.add(id);
  };
  add("first-apply", "📨", "Langkah Pertama", "Kirim lamaran pertamamu", apps >= 1);
  add("hunter", "🎯", "Pemburu Kerja", "Kirim 10 lamaran", apps >= 10);
  add(
    "noticed",
    "👀",
    "Dilirik HR",
    "Diundang interview oleh perusahaan",
    i.applications.some((a) => !!a.interview || a.status === "Diundang interview" || a.status === "Lolos interview"),
  );
  add(
    "hired",
    "🏆",
    "Diterima!",
    "Diterima kerja lewat job fair",
    i.applications.some((a) => a.status === "Diterima"),
  );
  add("explorer", "🧭", "Penjelajah", "Kunjungi 10 stand", i.stamps >= 10);
  add("collector", "🗺️", "Kolektor Stempel", "Kunjungi semua stand", i.booths > 0 && i.stamps >= i.booths);
  add("psych", "🧠", "Lulus Psikotes", "Lulus psikotes online", best >= i.psychPass);
  add("learner", "🎤", "Pembelajar", "Ikut seminar karier", i.player.seminars.length >= 1);
  add("streak", "🔥", "Rajin Datang", "Datang 7 hari berturut-turut", (i.player.streak ?? 0) >= 7);
  add("verified", "✔️", "Centang Biru", "Verifikasi akunmu", !!i.player.verified);
  add("senior", "⭐", "Kandidat Andal", "Capai level 5", levelOf(i.player.xp).level >= 5);
  add("ambassador", "🤝", "Duta Kampus", "Ajak 3 teman bergabung", i.friends >= 3);
  return list.map((b) => ({ ...b, got: got.has(b.id) })).sort((a, b) => Number(b.got) - Number(a.got));
}
