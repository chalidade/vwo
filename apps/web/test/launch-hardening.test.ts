// Fixes from the pre-launch audit: a company's website must be a web address (it becomes a link in the
// organiser's panel), booth PINs can't be guessed with many accounts, the old cafe venue pages stay
// shut in production, and the build never needs the database.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({ current: null as null | { id: string; email: string; name: string; role: string } }));
const db = vi.hoisted(() => ({
  createRegistration: vi.fn(),
  myRegistrations: vi.fn(),
  addBoothMember: vi.fn(),
  getVenueBySlug: vi.fn(),
  getLiveSnapshot: vi.fn(),
  getVenueLayout: vi.fn(),
  setFairApplicationStatus: vi.fn(),
}));
/** Keys the rate limiter refuses; every other key is allowed. */
const refused = vi.hoisted(() => new Set<string>());
const asked = vi.hoisted(() => [] as string[]);
const pin = vi.hoisted(() => ({ value: "482913" as string | null }));

vi.mock("@/lib/session", () => ({ currentUser: async () => user.current }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/ratelimit", () => ({
  allow: async (key: string) => {
    asked.push(key);
    return ![...refused].some((k) => key.startsWith(k));
  },
}));
vi.mock("@/lib/booth-pins", () => ({ boothPin: async () => pin.value, samePin: (a: string, b: string) => a === b }));
vi.mock("@/lib/fair", () => ({ canManageBooth: async () => true, applicationOut: (r: unknown) => r }));
vi.mock("@/lib/push", () => ({ pushTo: () => {} }));
vi.mock("@/lib/ats-hook", () => ({ notifyBoothHook: () => {} }));
vi.mock("@vwo/db", async (orig) => ({
  ...(await orig<typeof import("@vwo/db")>()),
  createRegistration: (_db: unknown, ...a: unknown[]) => db.createRegistration(...a),
  myRegistrations: (_db: unknown, ...a: unknown[]) => db.myRegistrations(...a),
  addBoothMember: (_db: unknown, ...a: unknown[]) => db.addBoothMember(...a),
  getVenueBySlug: (_db: unknown, ...a: unknown[]) => db.getVenueBySlug(...a),
  getLiveSnapshot: (_db: unknown, ...a: unknown[]) => db.getLiveSnapshot(...a),
  getVenueLayout: (_db: unknown, ...a: unknown[]) => db.getVenueLayout(...a),
  setFairApplicationStatus: (_db: unknown, ...a: unknown[]) => db.setFairApplicationStatus(...a),
  fairApplicationById: async () => null,
  readPrices: async () => ({}),
}));

const registrations = await import("../app/api/company/registrations/route");
const claim = await import("../app/api/jobfair/company/claim/route");
const venueLive = await import("../app/api/venues/[slug]/live/route");
const venueLayout = await import("../app/api/venues/[slug]/layout/route");
const campus = await import("../app/api/jobfair/campus/route");
const boothApps = await import("../app/api/jobfair/booths/[booth]/applications/route");

const req = (path: string, method: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://jobfair.co.id${path}`, {
    method,
    headers: { origin: "https://jobfair.co.id", host: "jobfair.co.id", "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const hr = { id: "4f1f6c1e-2b7a-4c55-9a39-1f5d8f1d0a11", email: "hr@contoh.co.id", name: "Rina", role: "user" };
const form = (website: string) => ({
  company: "PT Contoh Maju",
  industry: "Teknologi",
  color: "#2563eb",
  website,
  city: "Jakarta",
  contactName: "Rina",
  contactRole: "HR",
  email: "hr@contoh.co.id",
  phone: "0812 3456 7890",
  tier: "regular",
});

beforeEach(() => {
  user.current = hr;
  refused.clear();
  asked.length = 0;
  pin.value = "482913";
  for (const f of Object.values(db)) f.mockReset();
  db.myRegistrations.mockResolvedValue([]);
  db.createRegistration.mockImplementation(async (input: Record<string, unknown>) => ({ id: "r1", status: "unpaid", ...input }));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("company registration website", () => {
  it.each(["javascript:alert(document.cookie)", "javascript://x/%0aalert(1)", "data:text/html,<script>alert(1)</script>", "ftp://files.contoh.co.id"])(
    "refuses %s",
    async (website) => {
      const res = await registrations.POST(req("/api/company/registrations", "POST", form(website)));
      expect(res.status).toBe(400);
      expect(db.createRegistration).not.toHaveBeenCalled();
    },
  );

  it("keeps a plain address, with https added", async () => {
    const res = await registrations.POST(req("/api/company/registrations", "POST", form("contoh.co.id")));
    expect(res.status).toBe(201);
    expect(db.createRegistration.mock.calls[0]![0]).toMatchObject({ website: "https://contoh.co.id/" });
  });

  it("still allows no website at all", async () => {
    const res = await registrations.POST(req("/api/company/registrations", "POST", form("")));
    expect(res.status).toBe(201);
    expect(db.createRegistration.mock.calls[0]![0]).toMatchObject({ website: null });
  });
});

describe("booth PIN claim", () => {
  const body = { boothId: "tokokita", pin: "000000" };

  it("counts tries per address and per booth, not only per account", async () => {
    await claim.POST(req("/api/jobfair/company/claim", "POST", body, { "x-forwarded-for": "203.0.113.9" }));
    expect(asked).toContain("claim-ip:203.0.113.9");
    expect(asked).toContain("claim-booth:tokokita");
  });

  it("stops guessing at one booth from many accounts", async () => {
    refused.add("claim-booth:tokokita");
    const res = await claim.POST(req("/api/jobfair/company/claim", "POST", { ...body, pin: "482913" }));
    expect(res.status).toBe(429);
    expect(db.addBoothMember).not.toHaveBeenCalled();
  });

  it("lets the right PIN in while under the caps", async () => {
    const res = await claim.POST(req("/api/jobfair/company/claim", "POST", { ...body, pin: "482913" }));
    expect(res.status).toBe(200);
    expect(db.addBoothMember).toHaveBeenCalledWith("tokokita", hr.id);
  });
});

describe("old cafe venue pages", () => {
  const params = { params: Promise.resolve({ slug: "kopi" }) };

  it("answer 404 in production without reading anything", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await venueLive.GET(req("/api/venues/kopi/live", "GET"), params)).status).toBe(404);
    expect((await venueLayout.GET(req("/api/venues/kopi/layout", "GET"), params)).status).toBe(404);
    expect(db.getVenueBySlug).not.toHaveBeenCalled();
  });

  it("can be switched back on with VENUE_PAGES=1", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VENUE_PAGES", "1");
    db.getVenueBySlug.mockResolvedValue(null);
    expect((await venueLive.GET(req("/api/venues/kopi/live", "GET"), params)).status).toBe(404);
    expect(db.getVenueBySlug).toHaveBeenCalled();
  });
});

describe("campus leaderboard", () => {
  it("is read on request (CDN-cached), never prerendered at build time", () => {
    expect(campus.dynamic).toBe("force-dynamic");
    expect("revalidate" in campus).toBe(false);
  });
});

describe("booth application moves", () => {
  it("are rate limited per account", async () => {
    refused.add("app-status:");
    const res = await boothApps.PATCH(req("/api/jobfair/booths/tokokita/applications", "PATCH", { id: "7d0e2a52-1c3b-4f0a-9a7e-2b8f8f1c0a11", status: "Dilihat" }), {
      params: Promise.resolve({ booth: "tokokita" }),
    });
    expect(res.status).toBe(429);
    expect(db.setFairApplicationStatus).not.toHaveBeenCalled();
  });
});
