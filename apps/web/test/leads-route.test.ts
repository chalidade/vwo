// Booth and stall requests: sending one wants a session, our own site and a valid form; the list and
// every organiser action want an event admin; a request opens one booth or stall, once; and the
// public setup never carries a request's contact details.
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({ current: null as null | { id: string; email: string; role: string; earlyOrganizer?: boolean } }));
const db = vi.hoisted(() => ({
  createLead: vi.fn(),
  listLeads: vi.fn(),
  leadById: vi.fn(),
  editLead: vi.fn(),
  finishLead: vi.fn(),
  addBoothMember: vi.fn(),
  recordLeadRegistration: vi.fn(),
  deleteFairState: vi.fn(),
  readFairState: vi.fn(),
}));
const placeBooth = vi.hoisted(() => vi.fn());
const placeLeadStall = vi.hoisted(() => vi.fn());
const mail = vi.hoisted(() => vi.fn());
const allow = vi.hoisted(() => ({ ok: true }));

vi.mock("@/lib/session", () => ({ currentUser: async () => user.current }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/ratelimit", () => ({ allow: async () => allow.ok }));
vi.mock("@/lib/mail", () => ({ appUrl: () => "https://jobfair.co.id", sendMail: mail }));
vi.mock("@/lib/seminars", () => ({ kickSeminarPushes: () => {} }));
vi.mock("@/lib/booths", () => ({ placeBooth, PLACEMENT_KEY: "placement" }));
vi.mock("@/lib/stalls", () => ({ placeLeadStall, leadStallKey: (id: string) => `stall:lead-${id}`, rentedOut: (d: unknown) => d }));
vi.mock("@vwo/db", async (orig) => ({
  ...(await orig<typeof import("@vwo/db")>()),
  createLead: (_db: unknown, ...a: unknown[]) => db.createLead(...a),
  listLeads: () => db.listLeads(),
  leadById: (_db: unknown, ...a: unknown[]) => db.leadById(...a),
  editLead: (_db: unknown, ...a: unknown[]) => db.editLead(...a),
  finishLead: (_db: unknown, ...a: unknown[]) => db.finishLead(...a),
  addBoothMember: (_db: unknown, ...a: unknown[]) => db.addBoothMember(...a),
  recordLeadRegistration: (_db: unknown, ...a: unknown[]) => db.recordLeadRegistration(...a),
  deleteFairState: (_db: unknown, ...a: unknown[]) => db.deleteFairState(...a),
  readFairState: () => db.readFairState(),
  boothsOf: async () => [],
}));

const leads = await import("../app/api/jobfair/leads/route");
const one = await import("../app/api/jobfair/leads/[id]/route");
const fulfil = await import("../app/api/jobfair/leads/[id]/fulfil/route");
const state = await import("../app/api/jobfair/state/route");

const req = (path: string, method: string, body?: unknown, origin = "https://jobfair.co.id") =>
  new Request(`https://jobfair.co.id${path}`, {
    method,
    headers: { origin, host: "jobfair.co.id", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const ID = "7d0e2a52-1c3b-4f0a-9a7e-2b8f8f1c0a11";
const params = { params: Promise.resolve({ id: ID }) };
const USER = "4f1f6c1e-2b7a-4c55-9a39-1f5d8f1d0a11";
const company = { id: USER, email: "hr@contoh.co.id", role: "user" };
const panitia = { id: "a1", email: "panitia@jobfair.co.id", role: "user" };
const booth = {
  company: "PT Contoh Maju",
  industry: "Teknologi",
  city: "Jakarta",
  website: "",
  contactName: "Rina",
  contactRole: "HR",
  email: "hr@contoh.co.id",
  phone: "0812 3456 7890",
};
const stored = {
  id: ID,
  kind: "booth",
  status: "new",
  userId: USER,
  at: 1,
  updatedAt: 1,
  name: "PT Contoh Maju",
  industry: "Teknologi",
  city: "Jakarta",
  contactName: "Rina",
  contactRole: "HR",
  email: "hr@contoh.co.id",
  phone: "0812 3456 7890",
  want: null,
};

beforeEach(() => {
  process.env.ADMIN_EMAILS = "panitia@jobfair.co.id";
  user.current = null;
  allow.ok = true;
  for (const f of [...Object.values(db), placeBooth, placeLeadStall, mail]) f.mockReset();
  mail.mockResolvedValue(undefined);
  db.addBoothMember.mockResolvedValue(undefined);
  db.recordLeadRegistration.mockResolvedValue(undefined);
  db.leadById.mockResolvedValue(stored);
});

describe("POST /api/jobfair/leads", () => {
  it("wants a session, our own site and a valid form", async () => {
    expect((await leads.POST(req("/api/jobfair/leads", "POST", { kind: "booth", data: booth }))).status).toBe(401);
    user.current = company;
    expect((await leads.POST(req("/api/jobfair/leads", "POST", { kind: "booth", data: booth }, "https://evil.example"))).status).toBe(403);
    for (const bad of [
      { kind: "booth", data: { ...booth, email: "nope" } },
      { kind: "booth", data: { ...booth, website2: "bot" } },
      { kind: "booth", data: { ...booth, note: "x".repeat(501) } },
      { kind: "stall", data: booth },
      { kind: "kiosk", data: booth },
    ])
      expect((await leads.POST(req("/api/jobfair/leads", "POST", bad))).status).toBe(400);
    expect((await leads.POST(req("/api/jobfair/leads", "POST", { kind: "booth", data: { ...booth, note: "x".repeat(5000) } }))).status).toBe(413);
    allow.ok = false;
    expect((await leads.POST(req("/api/jobfair/leads", "POST", { kind: "booth", data: booth }))).status).toBe(429);
    expect(db.createLead).not.toHaveBeenCalled();
  });

  it("files the request under the signed-in account, with no price", async () => {
    user.current = company;
    db.createLead.mockImplementation(async (l: unknown) => ({ result: l }));
    const r = await leads.POST(req("/api/jobfair/leads", "POST", { kind: "booth", data: { ...booth, userId: "someone-else", price: 1 } }));
    expect(r.status).toBe(201);
    const lead = db.createLead.mock.calls[0]![0];
    expect(lead).toMatchObject({ kind: "booth", status: "new", userId: USER, name: "PT Contoh Maju" });
    expect(lead).not.toHaveProperty("price");
    db.createLead.mockResolvedValue({ error: "too_many_open" });
    expect((await leads.POST(req("/api/jobfair/leads", "POST", { kind: "booth", data: booth }))).status).toBe(409);
  });
});

describe("organiser routes", () => {
  it("are for event admins only", async () => {
    expect((await leads.GET()).status).toBe(403);
    user.current = company;
    expect((await leads.GET()).status).toBe(403);
    expect((await one.PATCH(req(`/api/jobfair/leads/${ID}`, "PATCH", { status: "contacted" }), params)).status).toBe(403);
    expect((await fulfil.POST(req(`/api/jobfair/leads/${ID}/fulfil`, "POST", { floor: 0, x: 4, y: 6, tier: "regular" }), params)).status).toBe(403);
    expect(db.listLeads).not.toHaveBeenCalled();
    expect(db.editLead).not.toHaveBeenCalled();
    expect(placeBooth).not.toHaveBeenCalled();
  });

  it("lists every request and changes status and notes for the organiser", async () => {
    user.current = panitia;
    db.listLeads.mockResolvedValue([stored]);
    expect(await (await leads.GET()).json()).toEqual({ leads: [stored] });
    db.editLead.mockResolvedValue({ result: { ...stored, status: "contacted" } });
    expect((await one.PATCH(req(`/api/jobfair/leads/${ID}`, "PATCH", { status: "contacted", orgNote: "Telepon besok" }), params)).status).toBe(200);
    expect(db.editLead).toHaveBeenCalledWith(ID, "a1", { status: "contacted", orgNote: "Telepon besok" });
    expect((await one.PATCH(req(`/api/jobfair/leads/${ID}`, "PATCH", { status: "paid" }), params)).status).toBe(400);
    expect((await one.PATCH(req(`/api/jobfair/leads/not-an-id`, "PATCH", { status: "new" }), { params: Promise.resolve({ id: "not-an-id" }) })).status).toBe(404);
  });

  it("opens the booth for free, gives the account access and mails the code and PIN", async () => {
    user.current = panitia;
    placeBooth.mockResolvedValue({ booth: { id: "pt-contoh-maju" }, pin: "123456" });
    db.finishLead.mockResolvedValue({ result: { ...stored, status: "done" } });
    const r = await fulfil.POST(req(`/api/jobfair/leads/${ID}/fulfil`, "POST", { floor: 0, x: 4, y: 6, tier: "premium" }), params);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ boothId: "pt-contoh-maju", pin: "123456" });
    expect(placeBooth.mock.calls[0]![0]).toMatchObject({ company: "PT Contoh Maju", tier: "premium", price: 0, method: "Formulir", floor: 0, x: 4, y: 6 });
    expect(db.finishLead).toHaveBeenCalledWith(ID, "a1", { boothId: "pt-contoh-maju", pin: "123456" });
    expect(db.addBoothMember).toHaveBeenCalledWith("pt-contoh-maju", USER);
    expect(db.recordLeadRegistration.mock.calls[0]!.slice(1)).toEqual(["a1", "pt-contoh-maju", "123456", "premium", "#2563eb"]);
    expect(mail.mock.calls[0]![0]).toBe("hr@contoh.co.id");
    expect(mail.mock.calls[0]![2]).toContain("PIN: 123456");
  });

  it("opens one booth per request: a done request is refused, and a lost race takes its booth down", async () => {
    user.current = panitia;
    db.leadById.mockResolvedValue({ ...stored, status: "done", result: { boothId: "x", at: 1, by: "a1" } });
    expect((await fulfil.POST(req(`/api/jobfair/leads/${ID}/fulfil`, "POST", { floor: 0, x: 4, y: 6, tier: "regular" }), params)).status).toBe(409);
    expect(placeBooth).not.toHaveBeenCalled();
    db.leadById.mockResolvedValue(stored);
    placeBooth.mockResolvedValue({ booth: { id: "pt-contoh-maju-2" }, pin: "654321" });
    db.finishLead.mockResolvedValue({ error: "not_open" });
    expect((await fulfil.POST(req(`/api/jobfair/leads/${ID}/fulfil`, "POST", { floor: 0, x: 4, y: 6, tier: "regular" }), params)).status).toBe(409);
    expect(db.deleteFairState).toHaveBeenCalledWith("booking:pt-contoh-maju-2");
    expect(db.addBoothMember).not.toHaveBeenCalled();
    expect(mail).not.toHaveBeenCalled();
    placeBooth.mockResolvedValue({ error: "slot_taken" });
    expect(await (await fulfil.POST(req(`/api/jobfair/leads/${ID}/fulfil`, "POST", { floor: 0, x: 4, y: 6, tier: "regular" }), params)).json()).toEqual({ error: "slot_taken" });
  });

  it("opens a food court stall in the chosen slot", async () => {
    user.current = panitia;
    db.leadById.mockResolvedValue({ ...stored, kind: "stall", name: "Warung Rina", sells: "Nasi uduk", wantSlot: 3 });
    placeLeadStall.mockResolvedValue({ stall: { id: "lead-7d0e2a52" } });
    db.finishLead.mockResolvedValue({ result: { status: "done" } });
    expect((await fulfil.POST(req(`/api/jobfair/leads/${ID}/fulfil`, "POST", { slot: 99 }), params)).status).toBe(400);
    expect((await fulfil.POST(req(`/api/jobfair/leads/${ID}/fulfil`, "POST", { slot: 3 }), params)).status).toBe(200);
    expect(placeLeadStall.mock.calls[0]!.slice(1)).toEqual([3, "a1"]);
    expect(db.finishLead).toHaveBeenCalledWith(ID, "a1", { stallId: "lead-7d0e2a52" });
    db.finishLead.mockResolvedValue({ error: "not_open" });
    expect((await fulfil.POST(req(`/api/jobfair/leads/${ID}/fulfil`, "POST", { slot: 3 }), params)).status).toBe(409);
    expect(db.deleteFairState).toHaveBeenCalledWith(`stall:lead-${ID}`);
  });
});

describe("the public setup", () => {
  it("never carries a request, even if one reached the read", async () => {
    user.current = company;
    db.readFairState.mockResolvedValue([
      { key: "org", data: { removed: [], added: [] }, updatedAt: new Date(1) },
      { key: `lead:${ID}`, data: stored, updatedAt: new Date(2) },
    ]);
    const body = JSON.stringify(await (await state.GET()).json());
    expect(body).not.toContain("hr@contoh.co.id");
    expect(body).not.toContain("0812 3456 7890");
  });
});
