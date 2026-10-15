// The bot checks of the public pre-registration form (lib/antibot.ts, lib/turnstile.ts) and how the
// route uses them: a signed token that is not too young, too old or used twice, the proof of work,
// Turnstile's hostname, action and age, slow mode when an event is flooded, and one inbox written
// many ways. Rate limits here are real counters in memory; the database is a small fake.
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const counts = vi.hoisted(() => new Map<string, number>());
const store = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], holds: new Map<string, number>() }));
const mail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/ratelimit", () => ({
  allow: async (key: string, limit: number) => {
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    return n <= limit;
  },
}));
vi.mock("@/lib/mail", () => ({ appUrl: () => "https://jobfair.co.id", sendMail: mail, mailEnabled: () => false }));
vi.mock("@vwo/db", async (orig) => {
  const real = await orig<typeof import("@vwo/db")>();
  const sig = (r: Record<string, unknown>) => (r.data as { _sig?: { ek?: string } })._sig;
  return {
    ...real,
    preregEventBySlug: async () => ({ event, count: store.rows.length }),
    holdUntil: async (_db: unknown, key: string) => ((store.holds.get(key) ?? 0) > Date.now() ? new Date(store.holds.get(key)!) : null),
    setHold: async (_db: unknown, key: string, ms: number) => void store.holds.set(key, Date.now() + ms),
    preregByEmail: async (_db: unknown, _e: string, email: string) => store.rows.find((r) => r.email === email) ?? null,
    submitPrereg: async (_db: unknown, input: { data: { email: string }; signals: { ek?: string } }) => {
      if (store.rows.some((r) => r.email === input.data.email)) return { status: "exists" };
      const twin = store.rows.find((r) => sig(r)?.ek === input.signals.ek);
      if (twin) return { status: "same_inbox", registration: twin };
      const row = {
        id: `r${store.rows.length}`,
        eventId: event.id,
        email: input.data.email,
        code: "JF-2345-6789",
        data: { ...input.data, _sig: input.signals },
        createdAt: new Date(),
      };
      store.rows.push(row);
      return { status: "created", code: row.code, registration: row };
    },
  };
});

const event = { id: "e1", slug: "job-fair-bandung", name: "Job Fair Bandung", startDate: null, endDate: null, location: "Online", open: true, deadline: null, capacity: null };
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

const antibot = await import("../lib/antibot");
const turnstile = await import("../lib/turnstile");
const submit = await import("../app/api/prereg/[slug]/route");
const { solvePow } = await import("@vwo/shared");

const BROWSER = "Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";
const post = (body: unknown, ua = BROWSER, ip = "36.71.12.9") =>
  submit.POST(
    new Request("https://jobfair.co.id/api/prereg/job-fair-bandung", {
      method: "POST",
      headers: { origin: "https://jobfair.co.id", host: "jobfair.co.id", "content-type": "application/json", "x-forwarded-for": ip, "user-agent": ua },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "job-fair-bandung" }) },
  );
const page = (bits = 4, age = 10_000) => antibot.issueFormToken("prereg:job-fair-bandung", bits, Date.now() - age);
const sealed = async (data: object, token = page(), bits = 4) => ({ data, form: token, pow: (await solvePow(token, bits)) ?? "" });

beforeEach(() => {
  counts.clear();
  store.rows = [];
  store.holds.clear();
  mail.mockReset();
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.PREREG_REQUIRE_CAPTCHA;
  delete process.env.PREREG_EVENT_BURST;
  process.env.PREREG_POW_BITS = "4";
  process.env.PREREG_POW_SLOW_BITS = "6";
  vi.restoreAllMocks();
});

describe("form token", () => {
  it("is accepted for its own form between 3 seconds and 2 hours old", () => {
    const now = Date.now();
    const t = antibot.issueFormToken("prereg:a", 13, now);
    expect(antibot.readFormToken(t, "prereg:a", now + 5_000)).toMatchObject({ ok: true, token: { bits: 13, issued: now } });
    expect(antibot.readFormToken(t, "prereg:a", now + 1_000)).toEqual({ ok: false, reason: "too_fast" });
    expect(antibot.readFormToken(t, "prereg:a", now + 3 * 3_600_000)).toEqual({ ok: false, reason: "token_old" });
    expect(antibot.readFormToken(t, "prereg:b", now + 5_000)).toEqual({ ok: false, reason: "token_form" });
    expect(antibot.readFormToken(undefined, "prereg:a", now)).toEqual({ ok: false, reason: "token_missing" });
  });

  it("can't be changed: a younger time or fewer bits breaks the signature", () => {
    const now = Date.now();
    const t = antibot.issueFormToken("prereg:a", 13, now);
    const parts = t.split(".");
    expect(antibot.readFormToken([parts[0], now - 60_000, ...parts.slice(2)].join("."), "prereg:a", now + 5_000)).toEqual({ ok: false, reason: "token_bad" });
    expect(antibot.readFormToken([parts[0], parts[1], 0, ...parts.slice(3)].join("."), "prereg:a", now + 5_000)).toEqual({ ok: false, reason: "token_bad" });
  });

  it("checks the proof of work with one hash", async () => {
    const t = antibot.issueFormToken("prereg:a", 8);
    const answer = (await solvePow(t, 8))!;
    expect(antibot.validPow(t, answer, 8)).toBe(true);
    const wrong = [...Array(50).keys()].map(String).find((n) => createHash("sha256").update(`${t}:${n}`).digest()[0] !== 0)!;
    expect(antibot.validPow(t, wrong, 8)).toBe(false);
    expect(antibot.validPow(t, undefined, 8)).toBe(false);
    expect(antibot.validPow(t, "1e9", 8)).toBe(false);
    expect(antibot.validPow(t, undefined, 0)).toBe(true);
  });
});

describe("Turnstile", () => {
  const answer = (o: object) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(o)));
  const now = Date.parse("2026-10-15T10:00:00Z");
  const fresh = new Date(now - 30_000).toISOString();

  it("passes a fresh answer from our host for this form", async () => {
    answer({ success: true, hostname: "jobfair.co.id", action: "prereg", challenge_ts: fresh });
    expect(await turnstile.verifyTurnstile("t", "1.2.3.4", { action: "prereg" }, now, "real-secret")).toEqual({ ok: true });
  });

  it("refuses another host, another form, an old answer or a failed one", async () => {
    answer({ success: true, hostname: "evil.example", action: "prereg", challenge_ts: fresh });
    expect(await turnstile.verifyTurnstile("t", "ip", { action: "prereg" }, now, "real-secret")).toEqual({ ok: false, reason: "turnstile_host" });
    answer({ success: true, hostname: "jobfair.co.id", action: "login", challenge_ts: fresh });
    expect(await turnstile.verifyTurnstile("t", "ip", { action: "prereg" }, now, "real-secret")).toEqual({ ok: false, reason: "turnstile_action" });
    answer({ success: true, hostname: "jobfair.co.id", action: "prereg", challenge_ts: new Date(now - 6 * 60_000).toISOString() });
    expect(await turnstile.verifyTurnstile("t", "ip", { action: "prereg" }, now, "real-secret")).toEqual({ ok: false, reason: "turnstile_old" });
    answer({ success: false });
    expect(await turnstile.verifyTurnstile("t", "ip", {}, now, "real-secret")).toEqual({ ok: false, reason: "turnstile_failed" });
    expect(await turnstile.verifyTurnstile(undefined, "ip", {}, now, "real-secret")).toEqual({ ok: false, reason: "turnstile_missing" });
  });

  it("takes a preview host this request came to, or one listed in TURNSTILE_HOSTNAMES", async () => {
    answer({ success: true, hostname: "vwo-git-x.vercel.app", challenge_ts: fresh });
    expect(await turnstile.verifyTurnstile("t", "ip", { host: "vwo-git-x.vercel.app" }, now, "real-secret")).toEqual({ ok: true });
    expect(turnstile.turnstileHosts(null, { TURNSTILE_HOSTNAMES: "a.example, b.example", APP_URL: "https://staging.jobfair.co.id" })).toEqual(
      new Set(["jobfair.co.id", "www.jobfair.co.id", "staging.jobfair.co.id", "a.example", "b.example"]),
    );
  });
});

describe("the public form against scripts", () => {
  it("lets a person through: token from the page, proof of work, a browser", async () => {
    const res = await post(await sealed(form));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.registration.code).toBe("JF-2345-6789");
    expect(body.registration.data).not.toHaveProperty("_sig");
    expect(typeof body.form).toBe("string");
    // What was kept: a hash of the network and the inbox, and the seconds it took. No address.
    const sig = (store.rows[0]!.data as { _sig: Record<string, unknown> })._sig;
    expect(Object.keys(sig).sort()).toEqual(["ek", "ft", "ib"]);
    expect(JSON.stringify(sig)).not.toContain("36.71");
    expect(sig.ft).toBeGreaterThanOrEqual(9);
  });

  it("answers every refused check the same, with a fresh token", async () => {
    const t = page();
    const cases = [
      { data: form },
      { data: form, form: "v1.nope" },
      { ...(await sealed(form, page(4, 500))) },
      // An answer that does not hash to the token's zeros (a fixed "0" would pass one time in 16).
      { ...(await sealed(form, t)), pow: [...Array(200).keys()].map(String).find((n) => !antibot.validPow(t, n, 4)) },
      { ...(await sealed(form)), website2: "http://spam" },
      { ...(await sealed({ ...form, fullName: "Murah www.spam.ru" })) },
    ];
    for (const body of cases) {
      const res = await post(body);
      expect(res.status).toBe(400);
      const out = await res.json();
      expect(out.error).toBe("verify_failed");
      expect(Object.keys(out).sort()).toEqual(["error", "form"]);
    }
    expect((await (await post(await sealed(form), "curl/8.4.0")).json()).error).toBe("verify_failed");
    expect(store.rows).toHaveLength(0);
  });

  it("takes each token once", async () => {
    const body = await sealed(form);
    expect((await post(body)).status).toBe(201);
    const again = await post({ ...body, data: { ...form, email: "lain@gmail.com" } });
    expect(again.status).toBe(400);
    expect(store.rows).toHaveLength(1);
  });

  it("counts one Gmail inbox written many ways as one sign-up and mails its code to the first spelling", async () => {
    const first = await post(await sealed(form));
    expect(first.status).toBe(201);
    const twin = await post(await sealed({ ...form, email: "s.a.r.i+2@gmail.com" }));
    expect(twin.status).toBe(409);
    expect((await twin.json()).error).toBe("already_registered");
    expect(store.rows).toHaveLength(1);
  });

  it("refuses a throwaway inbox and a non-Indonesian WhatsApp number, saying which", async () => {
    expect((await (await post(await sealed({ ...form, email: "x@yopmail.com" }))).json()).error).toBe("email_rejected");
    const phone = await (await post(await sealed({ ...form, whatsapp: "+1 415 555 0100" }))).json();
    expect(phone.error).toBe("invalid_input");
    expect(phone.fields).toEqual({ whatsapp: ["invalid_phone"] });
  });

  it("goes into slow mode when an event is flooded: a harder proof of work, and the organiser sees it", async () => {
    process.env.PREREG_EVENT_BURST = "5";
    for (let i = 0; i < 5; i++) expect((await post(await sealed({ ...form, email: `orang${i}@gmail.com` }), BROWSER, `10.0.${i}.1`)).status).toBe(201);
    const sixth = await post(await sealed({ ...form, email: "orang5@gmail.com" }), BROWSER, "10.0.9.1");
    expect(sixth.status).toBe(400);
    const next = (await sixth.json()).form as string;
    expect(next.split(".")[2]).toBe("6");
    expect(store.holds.get("prereg:slow:e1")).toBeGreaterThan(Date.now());
    // An old easy token is no longer enough; the harder one passes.
    expect((await post(await sealed({ ...form, email: "orang6@gmail.com" }), BROWSER, "10.0.10.1")).status).toBe(400);
    expect((await post(await sealed({ ...form, email: "orang7@gmail.com" }, page(6), 6), BROWSER, "10.0.11.1")).status).toBe(201);
  });

  it("limits one network (/24) beyond a single address", async () => {
    process.env.PREREG_RATE_PER_NET = "3";
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await post(await sealed({ ...form, email: `n${i}@gmail.com` }), BROWSER, `36.71.12.${i + 1}`)).status);
    expect(codes).toEqual([201, 201, 201, 429, 429]);
    delete process.env.PREREG_RATE_PER_NET;
  });

  it("refuses everything while PREREG_REQUIRE_CAPTCHA=1 and Turnstile is not set up", async () => {
    process.env.PREREG_REQUIRE_CAPTCHA = "1";
    expect((await post(await sealed(form))).status).toBe(400);
    expect(store.rows).toHaveLength(0);
  });
});
