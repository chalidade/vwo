// Lighter load: the public setup, totals and ratings are the same for everyone and kept by the CDN
// (with ETag and 304), and never carry anything private; what is personal comes from calls that are
// never cached; big pictures are served by hash; limits come from the environment.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({ current: null as null | { id: string; email: string; role: string; earlyOrganizer?: boolean }, reads: 0 }));
const db = vi.hoisted(() => ({
  readFairState: vi.fn(),
  readFairStateKey: vi.fn(),
  writeFairState: vi.fn(),
  boothsOf: vi.fn(),
  statTotals: vi.fn(),
  recentEvents: vi.fn(),
  reviewTotals: vi.fn(),
  myReviews: vi.fn(),
}));
const allowed = vi.hoisted(() => ({ calls: [] as [string, number, number][], ok: true }));

vi.mock("@/lib/session", () => ({
  currentUser: async () => {
    user.reads++;
    return user.current;
  },
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/ratelimit", () => ({
  allow: async (key: string, limit: number, ms: number) => {
    allowed.calls.push([key, limit, ms]);
    return allowed.ok;
  },
}));
vi.mock("@/lib/cleanup", () => ({ maybeCleanup: () => {} }));
vi.mock("@/lib/seminars", () => ({ kickSeminarPushes: () => {} }));
vi.mock("@/lib/google", () => ({ GOOGLE_COOKIE: "g", googleEnabled: () => true, startGoogle: () => ({ url: "https://accounts.google.com/o/oauth2", cookie: "c" }) }));
vi.mock("@vwo/db", async (orig) => ({
  ...(await orig<typeof import("@vwo/db")>()),
  readFairState: () => db.readFairState(),
  readFairStateKey: (_db: unknown, k: string) => db.readFairStateKey(k),
  writeFairState: (_db: unknown, ...a: unknown[]) => db.writeFairState(...a),
  boothsOf: (_db: unknown, id: string) => db.boothsOf(id),
  isBoothMember: async (_db: unknown, id: string, booth: string) => ((await db.boothsOf(id)) as string[]).includes(booth),
  statTotals: () => db.statTotals(),
  recentEvents: () => db.recentEvents(),
  reviewTotals: () => db.reviewTotals(),
  myReviews: (_db: unknown, id: string) => db.myReviews(id),
  readPrices: async () => ({ "coin.start": 50 }),
}));

const state = await import("../app/api/jobfair/state/route");
const mine = await import("../app/api/jobfair/state/mine/route");
const media = await import("../app/api/jobfair/state/media/[hash]/route");
const stats = await import("../app/api/jobfair/stats/route");
const reviews = await import("../app/api/jobfair/reviews/route");
const config = await import("../app/api/jobfair/config/route");
const google = await import("../app/api/auth/google/start/route");
const { envInt, publicCache } = await import("../lib/limits");
const { inBatches } = await import("../lib/batches");
const { extractMedia, restoreMedia, MEDIA_PATH } = await import("../lib/state-view");
const { poolMax } = await import("@vwo/db");

const ORIGIN = "https://jobfair.co.id";
const get = (path: string, headers: Record<string, string> = {}) => new Request(ORIGIN + path, { headers });
const put = (path: string, body: unknown) =>
  new Request(ORIGIN + path, { method: "PUT", headers: { origin: ORIGIN, host: "jobfair.co.id", "content-type": "application/json" }, body: JSON.stringify(body) });

const admin = { id: "a1", email: "panitia@jobfair.co.id", role: "user", earlyOrganizer: true };
const hr = { id: "u-hr", email: "hr@nusa.co.id", role: "user" };
const seeker = { id: "u-seeker", email: "sari@mail.example", role: "user" };

/** A picture big enough to be moved out of the setup, and one small enough to stay. */
const BIG = `data:image/png;base64,${"iVBORw0KGgo".repeat(800)}`;
const SMALL = "data:image/png;base64,iVBORw0KGgo=";
const PROOF = `data:image/jpeg;base64,${"/9j/4AAQSkZJRg".repeat(800)}`;

const rows = () => [
  { key: "org", data: { removed: [], added: [], pins: { nusa: "4821" }, bookings: [{ phone: "0812 1111 2222" }] }, updatedAt: new Date(1000) },
  {
    key: "company:nusa",
    data: { name: "PT Nusa", logo: BIG, icon: SMALL, svg: `data:image/svg+xml;base64,${"PHN2Zz4=".repeat(1000)}`, invoices: [{ id: "inv-1", proof: PROOF, total: 5_000_000 }] },
    updatedAt: new Date(2000),
  },
  { key: "company:lain", data: { name: "PT Lain", invoices: [{ id: "inv-2", total: 1 }] }, updatedAt: new Date(1500) },
  { key: "booking:x", data: { booth: "nusa", booking: { email: "booker@nusa.co.id" }, pin: "9911" }, updatedAt: new Date(1200) },
];

beforeEach(() => {
  user.current = null;
  user.reads = 0;
  allowed.calls = [];
  allowed.ok = true;
  for (const f of Object.values(db)) f.mockReset();
  db.readFairState.mockResolvedValue(rows());
  db.readFairStateKey.mockImplementation(async (k: string) => rows().find((r) => r.key === k) ?? null);
  db.boothsOf.mockImplementation(async (id: string) => (id === hr.id ? ["nusa"] : []));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the public setup", () => {
  it("is the same for everyone: never reads the session, kept by the CDN, nothing private in it", async () => {
    user.current = admin;
    const r = await state.GET(get("/api/jobfair/state"));
    expect(user.reads).toBe(0);
    expect(r.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=20, stale-while-revalidate=60");
    expect(r.headers.get("etag")).toMatch(/^".+"$/);
    const text = await r.text();
    for (const secret of ["4821", "9911", "0812 1111 2222", "booker@nusa.co.id", "inv-1", "inv-2", PROOF.slice(0, 60)]) expect(text).not.toContain(secret);
    const body = JSON.parse(text);
    expect(body.admin).toBeUndefined();
    expect(body.booths).toBeUndefined();
    expect(body.prices).toEqual({ "coin.start": 50 });
    expect(body.bookings).toEqual([{ booth: "nusa" }]);
    expect(body.companies.nusa.invoices).toEqual([]);
  });

  it("answers 304 to a copy that is still current, and a new body once something changed", async () => {
    const first = await state.GET(get("/api/jobfair/state"));
    const etag = first.headers.get("etag")!;
    const again = await state.GET(get("/api/jobfair/state", { "if-none-match": etag }));
    expect(again.status).toBe(304);
    expect(again.headers.get("etag")).toBe(etag);
    expect(await again.text()).toBe("");
    expect((await state.GET(get("/api/jobfair/state", { "if-none-match": `W/${etag}` }))).status).toBe(304);
    db.readFairState.mockResolvedValue([...rows(), { key: "company:baru", data: { name: "PT Baru" }, updatedAt: new Date(3000) }]);
    const changed = await state.GET(get("/api/jobfair/state", { "if-none-match": etag }));
    expect(changed.status).toBe(200);
    expect(changed.headers.get("etag")).not.toBe(etag);
  });

  it("skips the CDN right after a change (?fresh=1)", async () => {
    expect((await state.GET(get("/api/jobfair/state?fresh=1"))).headers.get("cache-control")).toBe("no-store");
  });

  it("follows STATE_CDN_SEC, and 0 turns the CDN copy off", async () => {
    vi.stubEnv("STATE_CDN_SEC", "45");
    expect((await state.GET(get("/api/jobfair/state"))).headers.get("cache-control")).toContain("s-maxage=45");
    vi.stubEnv("STATE_CDN_SEC", "0");
    expect((await state.GET(get("/api/jobfair/state"))).headers.get("cache-control")).toBe("no-store");
  });

  it("serves big pictures by hash, for a year, and keeps small ones and SVGs inline", async () => {
    const body = await (await state.GET(get("/api/jobfair/state"))).json();
    const logo = body.companies.nusa.logo as string;
    expect(logo.startsWith(MEDIA_PATH)).toBe(true);
    expect(body.companies.nusa.icon).toBe(SMALL);
    expect(body.companies.nusa.svg.startsWith("data:image/svg+xml")).toBe(true);
    const hash = logo.slice(MEDIA_PATH.length);
    const r = await media.GET(get(logo), { params: Promise.resolve({ hash }) });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(Buffer.from(await r.arrayBuffer()).equals(Buffer.from(BIG.split(",")[1]!, "base64"))).toBe(true);
  });

  it("never serves a picture the public setup doesn't show (an invoice proof), nor a malformed name", async () => {
    const proof = extractMedia({ p: PROOF }, 100).doc.p.slice(MEDIA_PATH.length);
    expect((await media.GET(get("/x"), { params: Promise.resolve({ hash: proof }) })).status).toBe(404);
    expect((await media.GET(get("/x"), { params: Promise.resolve({ hash: "../../etc" }) })).status).toBe(404);
  });

  it("puts pictures back when a browser saves a document carrying their URLs", async () => {
    user.current = admin;
    const pub = await (await state.GET(get("/api/jobfair/state"))).json();
    const doc = { ...pub.companies.nusa, name: "PT Nusa Baru" };
    expect((await state.PUT(put("/api/jobfair/state", { key: "company:nusa", data: doc }))).status).toBe(200);
    const saved = db.writeFairState.mock.calls[0]![0] as { data: { logo: string; name: string } };
    expect(saved.data.logo).toBe(BIG);
    expect(saved.data.name).toBe("PT Nusa Baru");
  });
});

describe("this account's own part of the setup", () => {
  it("wants a session", async () => {
    expect((await mine.GET()).status).toBe(401);
  });

  it("gives an event admin everything, never cached", async () => {
    user.current = admin;
    const r = await mine.GET();
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const body = await r.json();
    expect(body.admin).toBe(true);
    expect(body.org.pins).toEqual({ nusa: "4821" });
    expect(body.companies.nusa.logo).toBe(BIG);
    expect(body.companies.lain.invoices).toHaveLength(1);
    expect(body.bookings[0].pin).toBe("9911");
  });

  it("gives a booth account only its own booth, with its invoices", async () => {
    user.current = hr;
    const body = await (await mine.GET()).json();
    expect(body.admin).toBe(false);
    expect(Object.keys(body.companies)).toEqual(["nusa"]);
    expect(body.companies.nusa.invoices[0].id).toBe("inv-1");
    expect(JSON.stringify(body)).not.toContain("4821");
    expect(db.readFairState).not.toHaveBeenCalled();
  });

  it("gives anyone else nothing more", async () => {
    user.current = seeker;
    const body = await (await mine.GET()).json();
    expect(body.companies).toEqual({});
  });
});

describe("visit totals", () => {
  const totals = {
    "visit:nusa": { views: 3, clicks: 0, sold: 0, coins: 0 },
    "acc:nusa:banner": { views: 9, clicks: 1, sold: 0, coins: 0 },
    "stall:bakso": { views: 0, clicks: 0, sold: 4, coins: 32 },
  };

  it("public totals skip the session, are kept by the CDN, and leave out booth-private keys", async () => {
    db.statTotals.mockResolvedValue(totals);
    vi.stubEnv("STATS_CACHE_SEC", "0");
    user.current = admin;
    const r = await stats.GET(get("/api/jobfair/stats?public=1"));
    expect(user.reads).toBe(0);
    expect(r.headers.get("cache-control")).toBe("no-store");
    vi.stubEnv("STATS_CACHE_SEC", "30");
    const again = await stats.GET(get("/api/jobfair/stats?public=1"));
    expect(again.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=30, stale-while-revalidate=60");
    expect((await again.json()).stats).toEqual({ "visit:nusa": totals["visit:nusa"] });
  });

  it("one aggregation per instance while the totals are fresh", async () => {
    vi.stubEnv("STATS_CACHE_SEC", "0");
    db.statTotals.mockResolvedValue(totals);
    await stats.GET(get("/api/jobfair/stats?public=1"));
    vi.stubEnv("STATS_CACHE_SEC", "60");
    db.statTotals.mockClear();
    await stats.GET(get("/api/jobfair/stats?public=1"));
    await stats.GET(get("/api/jobfair/stats?public=1"));
    user.current = hr;
    await stats.GET(get("/api/jobfair/stats"));
    expect(db.statTotals).toHaveBeenCalledTimes(0);
  });

  it("a booth account's own keys come only from the personal call, never cached", async () => {
    vi.stubEnv("STATS_CACHE_SEC", "0");
    db.statTotals.mockResolvedValue(totals);
    user.current = hr;
    const r = await stats.GET(get("/api/jobfair/stats"));
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(Object.keys((await r.json()).stats).sort()).toEqual(["acc:nusa:banner", "visit:nusa"]);
  });
});

describe("booth ratings", () => {
  it("totals alone are public and skip the session; with this account's stars they are private", async () => {
    db.reviewTotals.mockResolvedValue({ nusa: { n: 2, sum: 9 } });
    db.myReviews.mockResolvedValue({ nusa: 5 });
    user.current = seeker;
    const pub = await reviews.GET(get("/api/jobfair/reviews?totals=1"));
    expect(user.reads).toBe(0);
    expect(pub.headers.get("cache-control")).toContain("public");
    expect(await pub.json()).toEqual({ totals: { nusa: { n: 2, sum: 9 } } });
    const own = await reviews.GET(get("/api/jobfair/reviews"));
    expect(own.headers.get("cache-control")).toBe("private, no-store");
    expect((await own.json()).mine).toEqual({ nusa: 5 });
  });
});

describe("limits from the environment", () => {
  it("the game's polling intervals: defaults for a small budget, the environment's when set, kept in range", async () => {
    const d = await (await config.GET()).json();
    expect(d).toMatchObject({ statePollSec: 60, applicationsPollSec: 30, statsPollSec: 120, portalPollSec: 15 });
    vi.stubEnv("STATE_POLL_SEC", "20");
    vi.stubEnv("APPLICATIONS_POLL_SEC", "1");
    vi.stubEnv("STATS_POLL_SEC", "lots");
    const e = await (await config.GET()).json();
    expect(e).toMatchObject({ statePollSec: 20, applicationsPollSec: 5, statsPollSec: 120 });
    expect(JSON.stringify(e)).not.toMatch(/secret|key|password/i);
  });

  it("Google sign-in: a whole venue behind one address gets 300 starts in ten minutes, one device 30", async () => {
    const req = (ua: string) => new Request(`${ORIGIN}/api/auth/google/start`, { headers: { "x-forwarded-for": "10.0.0.1", "user-agent": ua } });
    await google.GET(req("Mozilla/5.0 A"));
    await google.GET(req("Mozilla/5.0 B"));
    const ip = allowed.calls.filter(([k]) => k === "google:10.0.0.1");
    expect(ip).toHaveLength(2);
    expect(ip[0]![1]).toBe(300);
    const devices = new Set(allowed.calls.filter(([k]) => k.startsWith("google-ua:10.0.0.1:")).map(([k, n]) => `${k}/${n}`));
    expect(devices.size).toBe(2);
    expect([...devices].every((d) => d.endsWith("/30"))).toBe(true);
    vi.stubEnv("GOOGLE_RATE_PER_IP", "1000");
    await google.GET(req("Mozilla/5.0 A"));
    expect(allowed.calls.at(-1)).toEqual(["google:10.0.0.1", 1000, 600_000]);
    allowed.ok = false;
    const held = await google.GET(req("Mozilla/5.0 A"));
    expect(held.headers.get("location")).toBe(`${ORIGIN}/play/#/jobfair`);
  });

  it("reads whole numbers in range, else the default", () => {
    expect(envInt("X", 7, 1, 10, {})).toBe(7);
    expect(envInt("X", 7, 1, 10, { X: "" })).toBe(7);
    expect(envInt("X", 7, 1, 10, { X: "abc" })).toBe(7);
    expect(envInt("X", 7, 1, 10, { X: "99" })).toBe(10);
    expect(envInt("X", 7, 1, 10, { X: "0" })).toBe(1);
    expect(envInt("X", 7, 1, 10, { X: "4.6" })).toBe(5);
    expect(publicCache(0, 60)).toBe("no-store");
  });

  it("database connections per instance: 3 on Vercel, DB_POOL_MAX when set, at most 20", () => {
    expect(poolMax({ VERCEL: "1" })).toBe(3);
    expect(poolMax({})).toBe(10);
    expect(poolMax({ VERCEL: "1", DB_POOL_MAX: "2" })).toBe(2);
    expect(poolMax({ DB_POOL_MAX: "500" })).toBe(20);
    expect(poolMax({ VERCEL: "1", DB_POOL_MAX: "0" })).toBe(3);
  });
});

describe("pushes in batches", () => {
  it("never has more than a batch in flight, and sends every one", async () => {
    let flying = 0;
    let most = 0;
    const done: number[] = [];
    await inBatches(
      Array.from({ length: 230 }, (_, i) => i),
      50,
      async (i) => {
        most = Math.max(most, ++flying);
        await new Promise((r) => setTimeout(r, 1));
        flying--;
        done.push(i);
      },
    );
    expect(most).toBe(50);
    expect(done).toHaveLength(230);
  });
});

describe("pictures out of the setup", () => {
  it("swaps each big picture for its hash URL and back", () => {
    const { doc, media: found } = extractMedia({ a: [{ logo: BIG }], b: SMALL, c: "hello" }, 1000);
    expect(found.size).toBe(1);
    expect(doc.b).toBe(SMALL);
    expect(restoreMedia(doc, { old: BIG })).toEqual({ a: [{ logo: BIG }], b: SMALL, c: "hello" });
  });
});

describe("the park's buildings in the setup", () => {
  const buildings = [
    { id: "kampus-2027", name: "Job Fair Kampus", date: "Maret 2027", about: "Khusus fresh graduate", status: "soon" },
    { id: "rahasia", name: "Rapat sponsor", about: "Belum diumumkan ke publik", status: "hidden" },
  ];
  const withPark = () => rows().map((r) => (r.key === "org" ? { ...r, data: { ...r.data, buildings } } : r));

  it("shows every visitor only the buildings on show, and the organiser all of them", async () => {
    db.readFairState.mockResolvedValue(withPark());
    const text = await (await state.GET(get("/api/jobfair/state"))).text();
    expect(text).not.toContain("Rapat sponsor");
    expect(text).not.toContain("Belum diumumkan");
    expect(JSON.parse(text).org.buildings).toEqual([buildings[0]]);
    user.current = admin;
    expect((await (await mine.GET()).json()).org.buildings).toEqual(buildings);
  });

  it("is cleaned when the organiser saves: trimmed, capped, no markup in ids", async () => {
    user.current = admin;
    const many = Array.from({ length: 9 }, (_, i) => ({ id: i === 0 ? "<x>" : `g${i}`, name: ` Gedung ${i} `, about: "a".repeat(900), extra: "drop" }));
    expect((await state.PUT(put("/api/jobfair/state", { key: "org", data: { removed: [], added: [], buildings: many } }))).status).toBe(200);
    const saved = db.writeFairState.mock.calls[0]![0] as { data: { buildings: Record<string, unknown>[] } };
    expect(saved.data.buildings).toHaveLength(5);
    expect(saved.data.buildings[0]).toEqual({ id: "g1", name: "Gedung 1", about: "a".repeat(200), status: "soon" });
    expect((await state.PUT(put("/api/jobfair/state", { key: "org", data: { removed: [], added: [], buildings: "nope" } }))).status).toBe(200);
    expect((db.writeFairState.mock.calls[1]![0] as { data: { buildings: unknown } }).data.buildings).toEqual([]);
  });

  it("can't be changed by anyone but an event admin", async () => {
    user.current = hr;
    expect((await state.PUT(put("/api/jobfair/state", { key: "org", data: { removed: [], added: [], buildings } }))).status).toBe(403);
    expect(db.writeFairState).not.toHaveBeenCalled();
  });
});
