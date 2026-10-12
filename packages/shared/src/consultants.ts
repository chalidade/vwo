// Real consultants in the consultation lounge. There are four desks (LOUNGE.pods). The published
// event seats bot consultants at them; a person gets a desk by applying to the organiser (free,
// the organiser approves and picks the desk) or by buying a slot with coins (placed at once).
// Each placed consultant is one document (`consultant:<id>` on the server); everyone sees only the
// public profile, the desk and whether the desk is open. Contact details stay with the organiser.
import { type Consultant, DEMO_JOB_FAIR, LOUNGE } from "./jobfair";

/** How many consultation desks the lounge has. */
export const CONSULT_DESKS = LOUNGE.pods.length;

/** Limits for what a consultant fills in; the server checks the same ones. */
export const CONSULT_LIMITS = { name: 40, role: 50, org: 50, topic: 40, topics: 3, bio: 280, email: 120, phone: 20 } as const;

export const CONSULT_EMOJIS = ["🧭", "💼", "🧠", "📋", "🎓", "💡", "🤝", "📈", "🗣️", "🌱"] as const;
export const CONSULT_COLORS = ["#2563eb", "#db2777", "#7c3aed", "#0f766e", "#ea580c", "#16a34a", "#0891b2", "#475569"] as const;

/** The organiser's switch for the published bot consultants (their desks are free when off). */
export const CONSULT_CFG_KEY = "consultcfg";
/** One document per placed consultant. */
export const CONSULTANT_PREFIX = "consultant:";
/** One private document per account that applied (contact details: organiser only). */
export const CONSULT_REQ_PREFIX = "conreq:";

/** An open desk stays open this long after the consultant's page last said it is still there. */
export const CONSULT_OPEN_MS = 3 * 60_000;

/** What visitors see of a consultant at the desk. */
export interface ConsultantProfile {
  name: string;
  role: string;
  org?: string;
  topics: string[];
  bio?: string;
  emoji: string;
  color: string;
}

/** How the consultant got the desk: approved by the organiser, or a paid slot. */
export type ConsultVia = "panitia" | "slot";

/** A placed consultant as stored: the public profile plus who it belongs to and how to reach them. */
export interface ConsultantDoc {
  id: string;
  desk: number;
  profile: ConsultantProfile;
  via: ConsultVia;
  /** The account that owns the desk. */
  by: string;
  email?: string;
  phone?: string;
  paymentId?: string;
  at: number;
  /** The desk takes calls until this time (the consultant's page keeps pushing it forward). */
  openUntil?: number;
}

/** What every visitor's game gets: never the owner, email or phone. */
export interface PublicConsultant {
  id: string;
  desk: number;
  profile: ConsultantProfile;
  via: ConsultVia;
  open: boolean;
}

export type ConsultRequestStatus = "pending" | "approved" | "rejected" | "removed";

/** An application to the organiser, one per account (`conreq:<user id>`), seen only by its owner and the organiser. */
export interface ConsultRequest {
  userId: string;
  email: string;
  phone: string;
  profile: ConsultantProfile;
  status: ConsultRequestStatus;
  note?: string;
  at: number;
  decidedAt?: number;
  consultantId?: string;
}

/** The address a consultant's page listens on for calls from the lounge. */
export const consultAddress = (id: string) => `consult:${id}`;

/** Which desk a lounge consultant sits at. */
export const consultantDesk = (c: { desk?: number }, i: number) => c.desk ?? i;

export const isOpenNow = (d: { openUntil?: number }, now: number) => (d.openUntil ?? 0) > now;

/** The public part of a placed consultant. */
export function publicConsultant(d: ConsultantDoc, now: number): PublicConsultant {
  const p = d.profile;
  return {
    id: d.id,
    desk: d.desk,
    via: d.via,
    open: isOpenNow(d, now),
    profile: { name: p.name, role: p.role, ...(p.org ? { org: p.org } : {}), topics: [...p.topics], ...(p.bio ? { bio: p.bio } : {}), emoji: p.emoji, color: p.color },
  };
}

/** Who sits at each desk now: a placed person first, else a bot the organiser left on. */
export function deskHolders(bots: readonly Consultant[], botsOff: readonly string[], placed: readonly { id: string; desk: number }[]) {
  const out = new Map<number, { kind: "bot" | "live"; id: string }>();
  for (const p of placed) if (p.desk >= 0 && p.desk < CONSULT_DESKS && !out.has(p.desk)) out.set(p.desk, { kind: "live", id: p.id });
  bots.slice(0, CONSULT_DESKS).forEach((b, i) => {
    const desk = consultantDesk(b, i);
    if (!botsOff.includes(b.id) && !out.has(desk)) out.set(desk, { kind: "bot", id: b.id });
  });
  return out;
}

/** Desks nobody sits at, in order. */
export function freeConsultDesks(bots: readonly Consultant[], botsOff: readonly string[], placed: readonly { id: string; desk: number }[]) {
  const taken = deskHolders(bots, botsOff, placed);
  return Array.from({ length: CONSULT_DESKS }, (_, i) => i).filter((i) => !taken.has(i));
}

/** The lounge's consultants as the room shows them: each with its desk, real people as `live`. */
export function loungeConsultants(bots: readonly Consultant[], placed: readonly PublicConsultant[], botsOff: readonly string[]): Consultant[] {
  const holders = deskHolders(bots, botsOff, placed);
  const out: Consultant[] = [];
  for (const [desk, h] of [...holders].sort((a, b) => a[0] - b[0])) {
    if (h.kind === "bot") {
      const b = bots.find((x) => x.id === h.id)!;
      out.push({ ...b, desk });
    } else {
      const p = placed.find((x) => x.id === h.id)!;
      out.push({ id: p.id, ...p.profile, lines: [], desk, live: true, open: p.open });
    }
  }
  return out;
}

/** "Meja 1" for desk 0. */
export const deskName = (desk: number) => `Meja ${desk + 1}`;

/** The published bot consultants, one per desk. */
export const BOT_CONSULTANTS: Consultant[] = DEMO_JOB_FAIR.rooms.find((r) => r.kind === "konsultasi")?.consultants ?? [];

// ---- Decisions. Each one reads the desks and applications as stored and says what to write; the
// server runs them under a lock (packages/db consultants.ts), the offline demo on this browser's copy.

export interface ConsultSnapshot {
  placed: ConsultantDoc[];
  requests: ConsultRequest[];
  botsOff: string[];
}

/** What a decision writes (documents by key, replaced whole) and deletes, or why it refused. */
export type ConsultChange<T> = { result: T; put?: { key: string; data: unknown }[]; del?: string[] } | { error: string };

export const consultSnapshot = (rows: readonly { key: string; data: unknown }[]): ConsultSnapshot => ({
  placed: rows.filter((r) => r.key.startsWith(CONSULTANT_PREFIX)).map((r) => r.data as ConsultantDoc),
  requests: rows.filter((r) => r.key.startsWith(CONSULT_REQ_PREFIX)).map((r) => r.data as ConsultRequest),
  botsOff: ((rows.find((r) => r.key === CONSULT_CFG_KEY)?.data as { botsOff?: unknown[] } | undefined)?.botsOff ?? []).filter((x): x is string => typeof x === "string"),
});

const freeIn = (s: ConsultSnapshot, bots: readonly Consultant[]) => freeConsultDesks(bots, s.botsOff, s.placed);
const reqKey = (userId: string) => `${CONSULT_REQ_PREFIX}${userId}`;
const deskKey = (id: string) => `${CONSULTANT_PREFIX}${id}`;

export const consultOps = {
  /** Apply to the organiser for a desk, or change an application (a new one waits again). */
  apply(s: ConsultSnapshot, input: { userId: string; email: string; phone: string; profile: ConsultantProfile }, now: number): ConsultChange<ConsultRequest> {
    if (s.placed.some((p) => p.by === input.userId)) return { error: "has_desk" };
    const req: ConsultRequest = { userId: input.userId, email: input.email, phone: input.phone, profile: input.profile, status: "pending", at: now };
    return { result: req, put: [{ key: reqKey(input.userId), data: req }] };
  },

  /** The organiser approves an application onto a free desk, free of charge. */
  approve(
    s: ConsultSnapshot,
    userId: string,
    desk: number,
    id: string,
    now: number,
    bots: readonly Consultant[] = BOT_CONSULTANTS,
  ): ConsultChange<{ doc: ConsultantDoc; request: ConsultRequest }> {
    const req = s.requests.find((r) => r.userId === userId);
    if (!req) return { error: "not_found" };
    if (req.status !== "pending") return { error: "not_pending" };
    if (s.placed.some((p) => p.by === userId)) return { error: "has_desk" };
    if (!freeIn(s, bots).includes(desk)) return { error: "desk_taken" };
    const doc: ConsultantDoc = { id, desk, profile: req.profile, via: "panitia", by: userId, email: req.email, phone: req.phone, at: now };
    const request: ConsultRequest = { ...req, status: "approved", decidedAt: now, consultantId: id };
    return {
      result: { doc, request },
      put: [
        { key: deskKey(id), data: doc },
        { key: reqKey(userId), data: request },
      ],
    };
  },

  reject(s: ConsultSnapshot, userId: string, note: string, now: number): ConsultChange<ConsultRequest> {
    const req = s.requests.find((r) => r.userId === userId);
    if (!req) return { error: "not_found" };
    if (req.status !== "pending") return { error: "not_pending" };
    const next: ConsultRequest = { ...req, status: "rejected", note, decidedAt: now };
    return { result: next, put: [{ key: reqKey(userId), data: next }] };
  },

  /** The organiser takes a consultant off their desk; the desk is free again. */
  remove(s: ConsultSnapshot, id: string, now: number): ConsultChange<ConsultantDoc> {
    const doc = s.placed.find((p) => p.id === id);
    if (!doc) return { error: "not_found" };
    const req = s.requests.find((r) => r.userId === doc.by && r.consultantId === id);
    return {
      result: doc,
      del: [deskKey(id)],
      put: req ? [{ key: reqKey(req.userId), data: { ...req, status: "removed", decidedAt: now } satisfies ConsultRequest }] : [],
    };
  },

  /**
   * A paid slot: seat the buyer at the desk they picked, or the first free one if someone took it
   * meanwhile. The same payment is never seated twice; a buyer who already has a desk, or a full
   * lounge, is refused (the coins then go back).
   */
  placePaid(
    s: ConsultSnapshot,
    p: { id: string; userId: string; meta: unknown },
    id: string,
    now: number,
    bots: readonly Consultant[] = BOT_CONSULTANTS,
  ): ConsultChange<ConsultantDoc> {
    const meta = (p.meta ?? {}) as { desk?: number; profile?: ConsultantProfile; email?: string; phone?: string };
    const done = s.placed.find((d) => d.paymentId === p.id);
    if (done) return { result: done };
    if (!meta.profile) return { error: "invalid" };
    if (s.placed.some((d) => d.by === p.userId)) return { error: "has_desk" };
    const desks = freeIn(s, bots);
    const desk = desks.includes(meta.desk ?? -1) ? meta.desk! : desks[0];
    if (desk === undefined) return { error: "full" };
    const doc: ConsultantDoc = { id, desk, profile: meta.profile, via: "slot", by: p.userId, email: meta.email, phone: meta.phone, paymentId: p.id, at: now };
    // A paid slot also settles an application still waiting.
    const req = s.requests.find((r) => r.userId === p.userId && r.status === "pending");
    return {
      result: doc,
      put: [
        { key: deskKey(id), data: doc },
        ...(req ? [{ key: reqKey(p.userId), data: { ...req, status: "approved", decidedAt: now, consultantId: id } satisfies ConsultRequest }] : []),
      ],
    };
  },

  /** The desk owner changes the public profile. */
  profile(s: ConsultSnapshot, userId: string, profile: ConsultantProfile): ConsultChange<ConsultantDoc> {
    const doc = s.placed.find((p) => p.by === userId);
    if (!doc) return { error: "not_found" };
    const next = { ...doc, profile };
    return { result: next, put: [{ key: deskKey(doc.id), data: next }] };
  },

  /** The desk owner opens the desk (the page keeps it open while it is up) or closes it. */
  open(s: ConsultSnapshot, userId: string, open: boolean, now: number): ConsultChange<ConsultantDoc> {
    const doc = s.placed.find((p) => p.by === userId);
    if (!doc) return { error: "not_found" };
    const next = { ...doc, openUntil: open ? now + CONSULT_OPEN_MS : 0 };
    return { result: next, put: [{ key: deskKey(doc.id), data: next }] };
  },

  /** The organiser switches published bot consultants off (their desks become free) or back on. */
  botsOff(_s: ConsultSnapshot, off: readonly string[], bots: readonly Consultant[] = BOT_CONSULTANTS): ConsultChange<string[]> {
    const known = new Set(bots.map((b) => b.id));
    const list = [...new Set(off.filter((id) => known.has(id)))];
    return { result: list, put: [{ key: CONSULT_CFG_KEY, data: { botsOff: list } }] };
  },
};

/** A new consultant id: not guessable, so nobody can predict the call address before the desk exists. */
export const newConsultantId = () => `k${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
