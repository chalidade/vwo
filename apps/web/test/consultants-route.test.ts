// Lounge consultants: every route wants a session, the organiser's actions want an event admin, inputs
// are checked, and the public setup shows a desk's profile but never who owns it or how to reach them.
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({ current: null as null | { id: string; email: string; role: string; earlyOrganizer?: boolean } }));
const db = vi.hoisted(() => ({
  applyConsultant: vi.fn(),
  approveConsultant: vi.fn(),
  rejectConsultant: vi.fn(),
  removeConsultant: vi.fn(),
  setBotsOff: vi.fn(),
  setConsultantOpen: vi.fn(),
  updateConsultantProfile: vi.fn(),
  readConsultants: vi.fn(),
  readFairState: vi.fn(),
}));
const mail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ currentUser: async () => user.current }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/ratelimit", () => ({ allow: async () => true }));
vi.mock("@/lib/mail", () => ({ appUrl: () => "https://jobfair.co.id", sendMail: mail }));
vi.mock("@/lib/seminars", () => ({ kickSeminarPushes: () => {} }));
vi.mock("@vwo/db", async (orig) => ({
  ...(await orig<typeof import("@vwo/db")>()),
  applyConsultant: (_db: unknown, ...a: unknown[]) => db.applyConsultant(...a),
  approveConsultant: (_db: unknown, ...a: unknown[]) => db.approveConsultant(...a),
  rejectConsultant: (_db: unknown, ...a: unknown[]) => db.rejectConsultant(...a),
  removeConsultant: (_db: unknown, ...a: unknown[]) => db.removeConsultant(...a),
  setBotsOff: (_db: unknown, ...a: unknown[]) => db.setBotsOff(...a),
  setConsultantOpen: (_db: unknown, ...a: unknown[]) => db.setConsultantOpen(...a),
  updateConsultantProfile: (_db: unknown, ...a: unknown[]) => db.updateConsultantProfile(...a),
  readConsultants: () => db.readConsultants(),
  readFairState: () => db.readFairState(),
  readPrices: async () => ({}),
  boothsOf: async () => [],
}));

const admin = await import("../app/api/jobfair/consultants/route");
const me = await import("../app/api/jobfair/consultants/me/route");
const state = await import("../app/api/jobfair/state/route");

const req = (path: string, method: string, body?: unknown, origin = "https://jobfair.co.id") =>
  new Request(`https://jobfair.co.id${path}`, {
    method,
    headers: { origin, host: "jobfair.co.id", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const profile = { name: "Kak Rani", role: "Konsultan karier", topics: ["Review CV"], emoji: "🧭", color: "#2563eb" };
const contact = { email: "rani@example.com", phone: "0812 3456 7890" };
const USER = "4f1f6c1e-2b7a-4c55-9a39-1f5d8f1d0a11";
const seeker = { id: USER, email: "rani@example.com", role: "user" };
const panitia = { id: "a1", email: "panitia@jobfair.co.id", role: "user" };
const placed = {
  id: "k0123456789ab",
  desk: 2,
  profile: { ...profile, bio: "Halo" },
  via: "slot",
  by: USER,
  email: "rani@example.com",
  phone: "08123456789",
  paymentId: "pay-1",
  at: 1,
  openUntil: Date.now() + 60_000,
};

beforeEach(() => {
  process.env.ADMIN_EMAILS = "panitia@jobfair.co.id";
  user.current = null;
  for (const f of Object.values(db)) f.mockReset();
  mail.mockReset();
  mail.mockResolvedValue(undefined);
  db.readConsultants.mockResolvedValue({ placed: [placed], requests: [], botsOff: [] });
});

describe("/api/jobfair/consultants/me", () => {
  it("asks for a session on every method", async () => {
    expect((await me.GET()).status).toBe(401);
    expect((await me.POST(req("/api/jobfair/consultants/me", "POST", { profile, contact }))).status).toBe(401);
    expect((await me.PUT(req("/api/jobfair/consultants/me", "PUT", { profile }))).status).toBe(401);
    expect((await me.PATCH(req("/api/jobfair/consultants/me", "PATCH", { open: true }))).status).toBe(401);
  });

  it("refuses another site and checks sizes and topics", async () => {
    user.current = seeker;
    expect((await me.POST(req("/api/jobfair/consultants/me", "POST", { profile, contact }, "https://evil.example"))).status).toBe(403);
    for (const bad of [
      { profile: { ...profile, topics: [] }, contact },
      { profile: { ...profile, topics: ["a1", "b2", "c3", "d4"] }, contact },
      { profile: { ...profile, bio: "x".repeat(281) }, contact },
      { profile: { ...profile, color: "red" }, contact },
      { profile, contact: { ...contact, email: "nope" } },
      { profile, contact: { ...contact, phone: "call me" } },
    ])
      expect((await me.POST(req("/api/jobfair/consultants/me", "POST", bad))).status).toBe(400);
    expect(db.applyConsultant).not.toHaveBeenCalled();
  });

  it("files the application under the signed-in account and opens only its own desk", async () => {
    user.current = seeker;
    db.applyConsultant.mockResolvedValue({ result: { status: "pending" } });
    expect((await me.POST(req("/api/jobfair/consultants/me", "POST", { profile, contact, userId: "someone-else" }))).status).toBe(201);
    expect(db.applyConsultant.mock.calls[0]![0]).toMatchObject({ userId: USER, email: "rani@example.com" });
    db.setConsultantOpen.mockResolvedValue({ result: { openUntil: 5 } });
    expect((await me.PATCH(req("/api/jobfair/consultants/me", "PATCH", { open: true }))).status).toBe(200);
    expect(db.setConsultantOpen).toHaveBeenCalledWith(USER, true);
    const mine = await (await me.GET()).json();
    expect(mine.consultant).toMatchObject({ id: placed.id, open: true });
  });
});

describe("/api/jobfair/consultants (organiser)", () => {
  it("is for event admins only", async () => {
    expect((await admin.GET()).status).toBe(403);
    user.current = seeker;
    expect((await admin.GET()).status).toBe(403);
    expect((await admin.POST(req("/api/jobfair/consultants", "POST", { action: "remove", id: placed.id }))).status).toBe(403);
    expect(db.removeConsultant).not.toHaveBeenCalled();
  });

  it("approves onto a desk and emails the applicant, and checks the desk and ids", async () => {
    user.current = panitia;
    for (const bad of [
      { action: "approve", user: USER, desk: 4 },
      { action: "approve", user: "x", desk: 0 },
      { action: "remove", id: "../org" },
    ])
      expect((await admin.POST(req("/api/jobfair/consultants", "POST", bad))).status).toBe(400);
    db.approveConsultant.mockResolvedValue({ result: { doc: { ...placed, via: "panitia" }, request: { email: "rani@example.com" } } });
    expect((await admin.POST(req("/api/jobfair/consultants", "POST", { action: "approve", user: USER, desk: 2 }))).status).toBe(200);
    expect(db.approveConsultant).toHaveBeenCalledWith("a1", USER, 2);
    expect(mail.mock.calls[0]![0]).toBe("rani@example.com");
    db.approveConsultant.mockResolvedValue({ error: "desk_taken" });
    expect((await admin.POST(req("/api/jobfair/consultants", "POST", { action: "approve", user: USER, desk: 2 }))).status).toBe(409);
  });
});

describe("the public setup", () => {
  it("shows a placed consultant's profile and desk, never the owner, contact or payment, nor applications", async () => {
    db.readFairState.mockResolvedValue([
      { key: `consultant:${placed.id}`, data: placed, updatedAt: new Date(1) },
      { key: "consultcfg", data: { botsOff: ["hr-hendra"] }, updatedAt: new Date(2) },
    ]);
    const body = await (await state.GET(new Request("https://jobfair.co.id/api/jobfair/state"))).json();
    expect(body.consultants).toEqual([{ id: placed.id, desk: 2, via: "slot", open: true, profile: { ...profile, bio: "Halo" } }]);
    expect(body.consultBotsOff).toEqual(["hr-hendra"]);
    const text = JSON.stringify(body);
    for (const secret of [USER, "rani@example.com", "08123456789", "pay-1"]) expect(text).not.toContain(secret);
  });
});
