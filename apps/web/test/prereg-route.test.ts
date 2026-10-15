// Pre-registration routes: the event list, registrants and CSV are for event admins only; the public
// form wants our own site, a clean body and (when on) Turnstile; a sign-up is shown back only for the
// matching email and code, with one answer for every mismatch; and "Punya kode?" links only a sign-up
// made with the signed-in account's own email. The form's own bot checks are in antibot.test.ts; here
// every public sending carries a real signed token and proof of work, as the page gives them.
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));
const db = vi.hoisted(() => ({
  listPreregEvents: vi.fn(),
  createPreregEvent: vi.fn(),
  updatePreregEvent: vi.fn(),
  deletePreregEvent: vi.fn(),
  preregEventById: vi.fn(),
  preregEventBySlug: vi.fn(),
  preregRegistrants: vi.fn(),
  setPreregEmail: vi.fn(),
  deletePrereg: vi.fn(),
  submitPrereg: vi.fn(),
  findPrereg: vi.fn(),
  preregByEmail: vi.fn(),
  linkPreregistrations: vi.fn(),
  claimPrereg: vi.fn(),
  myPreregistrations: vi.fn(),
  markPreregWelcomed: vi.fn(),
  holdUntil: vi.fn(),
  setHold: vi.fn(),
  preregByCode: vi.fn(),
  deletePreregs: vi.fn(),
}));
const allow = vi.hoisted(() => ({ ok: true }));
const human = vi.hoisted(() => ({ ok: true }));
const mail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ currentUser: async () => user.current }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/ratelimit", () => ({ allow: async () => allow.ok }));
vi.mock("@/lib/turnstile", () => ({
  isHuman: async () => human.ok,
  verifyTurnstile: async () => (human.ok ? { ok: true } : { ok: false, reason: "turnstile_failed" }),
}));
vi.mock("@/lib/mail", () => ({ appUrl: () => "https://jobfair.co.id", sendMail: mail, mailEnabled: () => true }));
vi.mock("@vwo/db", async (orig) => {
  const real = await orig<typeof import("@vwo/db")>();
  const wrapped = Object.fromEntries(Object.keys(db).map((k) => [k, (_db: unknown, ...a: unknown[]) => (db as Record<string, (...x: unknown[]) => unknown>)[k]!(...a)]));
  return { ...real, ...wrapped };
});

const events = await import("../app/api/jobfair/prereg-events/route");
const oneEvent = await import("../app/api/jobfair/prereg-events/[id]/route");
const registrants = await import("../app/api/jobfair/prereg-events/[id]/registrants/route");
const oneRegistrant = await import("../app/api/jobfair/prereg-events/[id]/registrants/[rid]/route");
const submit = await import("../app/api/prereg/[slug]/route");
const lookup = await import("../app/api/prereg/[slug]/lookup/route");
const mine = await import("../app/api/jobfair/prereg/route");
const { issueFormToken } = await import("../lib/antibot");
const { solvePow } = await import("@vwo/shared");

/** A sending as the page makes it: the form, a token issued 10 s ago and its proof of work. */
async function sealed(body: Record<string, unknown>, bits = 4, slug = "job-fair-bandung") {
  const form = issueFormToken(`prereg:${slug}`, bits, Date.now() - 10_000);
  return { ...body, form, pow: (await solvePow(form, bits)) ?? "" };
}

const req = (path: string, method: string, body?: unknown, origin = "https://jobfair.co.id") =>
  new Request(`https://jobfair.co.id${path}`, {
    method,
    headers: { origin, host: "jobfair.co.id", "content-type": "application/json", "x-forwarded-for": "10.0.0.1", "user-agent": "Mozilla/5.0 (Linux; Android 14) Chrome/130" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const EID = "7d0e2a52-1c3b-4f0a-9a7e-2b8f8f1c0a11";
const RID = "4f1f6c1e-2b7a-4c55-9a39-1f5d8f1d0a11";
const admin = { id: "a1", email: "panitia@jobfair.co.id", role: "super_admin", emailVerifiedAt: new Date() };
const seeker = { id: "s1", email: "sari@gmail.com", role: "user", emailVerifiedAt: new Date() };
const event = {
  id: EID,
  slug: "job-fair-bandung",
  name: "Job Fair Bandung",
  startDate: "2027-03-10",
  endDate: null,
  location: "Online",
  about: null,
  banner: null,
  capacity: null,
  open: true,
  deadline: null,
  createdBy: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const form = {
  fullName: "Sari Wulandari",
  email: "sari@gmail.com",
  whatsapp: "0812 3456 7890",
  city: "Kota Bandung",
  age: "18–22",
  education: "S1",
  major: "Teknik Informatika",
  institution: "Universitas Padjadjaran",
  status: "Fresh graduate",
  fields: ["Teknologi informasi"],
  jobTypes: ["Full-time"],
  consent: true,
};
const registration = {
  id: RID,
  eventId: EID,
  email: "sari@gmail.com",
  code: "JF-7K3M-Q9TX",
  data: form,
  userId: null,
  linkedAt: null,
  welcomedAt: null,
  createdAt: new Date(1),
  updatedAt: new Date(1),
};
const p = <T extends Record<string, string>>(o: T) => ({ params: Promise.resolve(o) });

beforeEach(() => {
  for (const f of Object.values(db)) f.mockReset();
  mail.mockReset();
  allow.ok = true;
  human.ok = true;
  user.current = null;
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SITE_KEY;
  process.env.PREREG_POW_BITS = "4";
  process.env.RESEND_API_KEY = "test";
  db.preregEventBySlug.mockResolvedValue({ event, count: 0 });
  db.preregEventById.mockResolvedValue(event);
});

describe("organiser routes", () => {
  it("refuse everyone but event admins", async () => {
    for (const who of [null, seeker]) {
      user.current = who;
      expect((await events.GET()).status).toBe(403);
      expect((await events.POST(req("/api/jobfair/prereg-events", "POST", { name: "X Fair", location: "Online", open: true }))).status).toBe(403);
      expect((await oneEvent.PATCH(req("/x", "PATCH", { name: "X Fair", location: "Online", open: true }), p({ id: EID }))).status).toBe(403);
      expect((await oneEvent.DELETE(req("/x", "DELETE"), p({ id: EID }))).status).toBe(403);
      expect((await registrants.GET(req(`/x?format=csv`, "GET"), p({ id: EID }))).status).toBe(403);
      expect((await oneRegistrant.PATCH(req("/x", "PATCH", { email: "a@gmail.com" }), p({ id: EID, rid: RID }))).status).toBe(403);
      expect((await oneRegistrant.DELETE(req("/x", "DELETE"), p({ id: EID, rid: RID }))).status).toBe(403);
    }
    expect(db.listPreregEvents).not.toHaveBeenCalled();
    expect(db.preregRegistrants).not.toHaveBeenCalled();
  });

  it("refuse a foreign site's form post even for an admin", async () => {
    user.current = admin;
    expect((await events.POST(req("/api/jobfair/prereg-events", "POST", { name: "X Fair", location: "Online", open: true }, "https://evil.example"))).status).toBe(403);
  });

  it("export registrants as CSV for an admin", async () => {
    user.current = admin;
    db.preregRegistrants.mockResolvedValue([registration]);
    const res = await registrants.GET(req(`/x?format=csv&q=sari`, "GET"), p({ id: EID }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("pendaftar-job-fair-bandung.csv");
    expect(await res.text()).toContain("JF-7K3M-Q9TX");
    expect(db.preregRegistrants).toHaveBeenCalledWith(EID, "sari");
  });

  it("create an event from a checked form", async () => {
    user.current = admin;
    db.createPreregEvent.mockResolvedValue(event);
    const res = await events.POST(req("/api/jobfair/prereg-events", "POST", { name: "Job Fair Bandung", location: "Online", open: true, startDate: "2027-03-10" }));
    expect(res.status).toBe(201);
    expect(
      (await events.POST(req("/api/jobfair/prereg-events", "POST", { name: "Job Fair", location: "Online", open: true, banner: "data:image/svg+xml;base64,AA" }))).status,
    ).toBe(400);
  });

  it("mark suspicious sign-ups without showing what was kept about them", async () => {
    user.current = admin;
    const twin = { ...registration, id: "5f1f6c1e-2b7a-4c55-9a39-1f5d8f1d0a11", email: "s.a.r.i@gmail.com", code: "JF-2222-3333", data: { ...form, _sig: { ib: "n", ft: 3 } } };
    db.preregRegistrants.mockResolvedValue([registration, twin]);
    const out = (await (await registrants.GET(req("/x", "GET"), p({ id: EID }))).json()).registrants;
    expect(out[1].suspect).toMatchObject({ flagged: true });
    expect(out[1].suspect.reasons).toEqual(expect.arrayContaining(["very_fast", "same_inbox"]));
    expect(out[1].data).not.toHaveProperty("_sig");
  });

  it("delete many sign-ups at once for an admin only", async () => {
    const ids = [RID];
    user.current = seeker;
    expect((await registrants.DELETE(req("/x", "DELETE", { ids }), p({ id: EID }))).status).toBe(403);
    user.current = admin;
    expect((await registrants.DELETE(req("/x", "DELETE", { ids }, "https://evil.example"), p({ id: EID }))).status).toBe(403);
    expect((await registrants.DELETE(req("/x", "DELETE", { ids: ["nope"] }), p({ id: EID }))).status).toBe(400);
    db.deletePreregs.mockResolvedValue(1);
    const res = await registrants.DELETE(req("/x", "DELETE", { ids: [RID, RID] }), p({ id: EID }));
    expect(await res.json()).toEqual({ deleted: 1 });
    expect(db.deletePreregs).toHaveBeenCalledWith(EID, [RID]);
  });

  it("won't delete an event with registrants", async () => {
    user.current = admin;
    db.deletePreregEvent.mockResolvedValue(false);
    const res = await oneEvent.DELETE(req("/x", "DELETE"), p({ id: EID }));
    expect(res.status).toBe(409);
  });
});

describe("public form", () => {
  it("signs up and answers with only the caller's own data and code", async () => {
    db.submitPrereg.mockResolvedValue({ status: "created", code: "JF-7K3M-Q9TX", registration });
    const res = await submit.POST(req("/api/prereg/job-fair-bandung", "POST", await sealed({ data: form })), p({ slug: "job-fair-bandung" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.registration.code).toBe("JF-7K3M-Q9TX");
    expect(body.registration.data.email).toBe("sari@gmail.com");
    expect(body.registration).not.toHaveProperty("userId");
  });

  it("refuses bots: a filled honeypot, a failed Turnstile, a foreign site, too many tries", async () => {
    db.submitPrereg.mockResolvedValue({ status: "created", code: "JF-7K3M-Q9TX", registration });
    expect((await submit.POST(req("/x", "POST", await sealed({ data: form, website2: "spam" })), p({ slug: "job-fair-bandung" }))).status).toBe(400);
    process.env.TURNSTILE_SECRET_KEY = "s";
    process.env.TURNSTILE_SITE_KEY = "k";
    human.ok = false;
    expect((await submit.POST(req("/x", "POST", await sealed({ data: form })), p({ slug: "job-fair-bandung" }))).status).toBe(400);
    human.ok = true;
    expect((await submit.POST(req("/x", "POST", await sealed({ data: form }), "https://evil.example"), p({ slug: "job-fair-bandung" }))).status).toBe(403);
    allow.ok = false;
    expect((await submit.POST(req("/x", "POST", await sealed({ data: form })), p({ slug: "job-fair-bandung" }))).status).toBe(429);
    expect(db.submitPrereg).not.toHaveBeenCalled();
  });

  it("refuses an oversized or malformed body", async () => {
    const big = { data: { ...form, experience: "x".repeat(9000) } };
    expect((await submit.POST(req("/x", "POST", big), p({ slug: "job-fair-bandung" }))).status).toBe(413);
    expect((await submit.POST(req("/x", "POST", { data: { ...form, link: "javascript:alert(1)" } }), p({ slug: "job-fair-bandung" }))).status).toBe(400);
  });

  it("returns no one's data when the email signed up before without its code, and resends the code to that email", async () => {
    db.submitPrereg.mockResolvedValue({ status: "exists" });
    db.preregByEmail.mockResolvedValue(registration);
    const res = await submit.POST(req("/x", "POST", await sealed({ data: { ...form, fullName: "Penyusup" } })), p({ slug: "job-fair-bandung" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({ error: "already_registered", resent: true });
    expect(Object.keys(body).sort()).toEqual(["error", "form", "resent"]);
    expect(JSON.stringify(body)).not.toContain("JF-7K3M-Q9TX");
    expect(mail).toHaveBeenCalledWith("sari@gmail.com", expect.stringContaining("JF-7K3M-Q9TX"), expect.any(String));
  });

  it("still signs up when the confirmation email fails", async () => {
    db.submitPrereg.mockResolvedValue({ status: "created", code: "JF-7K3M-Q9TX", registration });
    mail.mockRejectedValue(new Error("down"));
    const res = await submit.POST(req("/x", "POST", await sealed({ data: form })), p({ slug: "job-fair-bandung" }));
    expect(res.status).toBe(201);
    expect((await res.json()).mailed).toBe(false);
  });
});

describe("lookup", () => {
  it("shows one's own sign-up for the right email and code", async () => {
    db.findPrereg.mockResolvedValue(registration);
    const res = await lookup.POST(req("/x", "POST", { email: "sari@gmail.com", code: "jf-7k3m-q9tx" }), p({ slug: "job-fair-bandung" }));
    expect(res.status).toBe(200);
    expect(db.findPrereg).toHaveBeenCalledWith(EID, "sari@gmail.com", "JF-7K3M-Q9TX");
  });

  it("answers the same 404 for a wrong code, a wrong email, a malformed code or an unknown event", async () => {
    db.findPrereg.mockResolvedValue(null);
    const answers = [];
    answers.push(await lookup.POST(req("/x", "POST", { email: "sari@gmail.com", code: "JF-2222-2222" }), p({ slug: "job-fair-bandung" })));
    answers.push(await lookup.POST(req("/x", "POST", { email: "lain@gmail.com", code: "JF-7K3M-Q9TX" }), p({ slug: "job-fair-bandung" })));
    answers.push(await lookup.POST(req("/x", "POST", { email: "sari@gmail.com", code: "nope" }), p({ slug: "job-fair-bandung" })));
    db.preregEventBySlug.mockResolvedValue(null);
    answers.push(await lookup.POST(req("/x", "POST", { email: "sari@gmail.com", code: "JF-7K3M-Q9TX" }), p({ slug: "tidak-ada" })));
    for (const a of answers) {
      expect(a.status).toBe(404);
      expect(await a.json()).toEqual({ error: "not_found" });
    }
  });

  it("finds one's sign-up when the same Gmail inbox is written another way, still only with its code", async () => {
    db.findPrereg.mockResolvedValue(null);
    db.preregByCode.mockResolvedValue(registration);
    expect((await lookup.POST(req("/x", "POST", { email: "s.a.r.i+1@gmail.com", code: "JF-7K3M-Q9TX" }), p({ slug: "job-fair-bandung" }))).status).toBe(200);
    expect((await lookup.POST(req("/x", "POST", { email: "lain@gmail.com", code: "JF-7K3M-Q9TX" }), p({ slug: "job-fair-bandung" }))).status).toBe(404);
  });

  it("stops guessing", async () => {
    allow.ok = false;
    expect((await lookup.POST(req("/x", "POST", { email: "sari@gmail.com", code: "JF-7K3M-Q9TX" }), p({ slug: "job-fair-bandung" }))).status).toBe(429);
    expect(db.findPrereg).not.toHaveBeenCalled();
  });
});

describe("signed-in account", () => {
  it("links sign-ups for a verified email and lists the events with the welcome", async () => {
    user.current = seeker;
    db.linkPreregistrations.mockResolvedValue({ linked: 1, filled: [] });
    db.myPreregistrations.mockResolvedValue([{ id: RID, code: "JF-7K3M-Q9TX", linkedAt: new Date(), welcomedAt: null, event }]);
    const res = await mine.GET();
    const body = await res.json();
    expect(db.linkPreregistrations).toHaveBeenCalledWith(seeker);
    expect(body.welcome).toHaveLength(1);
    expect(body.events[0]).toMatchObject({ code: "JF-7K3M-Q9TX", name: "Job Fair Bandung" });
  });

  it("does not link for an unverified email", async () => {
    user.current = { ...seeker, emailVerifiedAt: null };
    db.myPreregistrations.mockResolvedValue([]);
    await mine.GET();
    expect(db.linkPreregistrations).not.toHaveBeenCalled();
  });

  it("claims a code only through the email check, with one answer for every miss", async () => {
    user.current = seeker;
    db.claimPrereg.mockResolvedValue(null);
    const miss = await mine.POST(req("/api/jobfair/prereg", "POST", { action: "claim", code: "JF-7K3M-Q9TX" }));
    expect(miss.status).toBe(404);
    expect(db.claimPrereg).toHaveBeenCalledWith(seeker, "JF-7K3M-Q9TX");
    db.claimPrereg.mockResolvedValue(registration);
    db.myPreregistrations.mockResolvedValue([{ id: RID, code: "JF-7K3M-Q9TX", linkedAt: new Date(), welcomedAt: null, event }]);
    expect((await mine.POST(req("/api/jobfair/prereg", "POST", { action: "claim", code: "JF-7K3M-Q9TX" }))).status).toBe(200);
    user.current = null;
    expect((await mine.POST(req("/api/jobfair/prereg", "POST", { action: "claim", code: "JF-7K3M-Q9TX" }))).status).toBe(401);
  });
});
