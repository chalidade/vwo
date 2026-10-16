// Request size limits and what a newly placed booth shows the public.
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const stored = vi.hoisted(() => ({ doc: null as null | { key: string; data: unknown } }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@vwo/db", () => ({
  readFairState: async () => [],
  putFairStateLocked: async (_db: unknown, _lock: string, _user: string, decide: (rows: unknown[]) => { key: string; data: unknown }) => {
    stored.doc = decide([]);
    return stored.doc;
  },
}));

const { readBody, readCapped, readSizedBody } = await import("../lib/http");
const { placeBooth } = await import("../lib/booths");

const post = (body: string | ReadableStream<Uint8Array>, headers: Record<string, string> = {}) =>
  new Request("https://jobfair.co.id/api/x", { method: "POST", body, headers, duplex: "half" } as RequestInit);

describe("readCapped", () => {
  it("reads a body up to the limit", async () => {
    expect(await readCapped(post("halo"), 4)).toBe("halo");
    expect(await readCapped(post(""), 4)).toBe("");
  });

  it("refuses a longer body, counted in characters", async () => {
    expect(await readCapped(post("halo!"), 4)).toBeNull();
    // Four characters of three bytes each still fit in four.
    expect(await readCapped(post("€€€€"), 4)).toBe("€€€€");
  });

  it("refuses a body whose declared length is far too big, before reading it", async () => {
    expect(await readCapped(post("x", { "content-length": "999999" }), 10)).toBeNull();
  });

  it("stops reading an endless body", async () => {
    let sent = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(c) {
        sent++;
        c.enqueue(new Uint8Array(64 * 1024).fill(97));
      },
    });
    expect(await readCapped(post(endless), 100_000)).toBeNull();
    expect(sent).toBeLessThan(10);
  });
});

describe("readBody", () => {
  const schema = z.object({ name: z.string().max(10) });

  it("parses and checks a JSON body", async () => {
    expect(await readBody(post(JSON.stringify({ name: "Ana" })), schema)).toEqual({ data: { name: "Ana" } });
    const bad = await readBody(post("{"), schema);
    expect("error" in bad && bad.error.status).toBe(400);
  });

  it("answers 413 to a body over its limit", async () => {
    const r = await readBody(post(JSON.stringify({ name: "x".repeat(2_000_000) })), schema);
    expect("error" in r && r.error.status).toBe(413);
    const s = await readSizedBody(post(JSON.stringify({ name: "Ana" })), schema, 5);
    expect("error" in s && s.error.status).toBe(413);
  });
});

describe("placeBooth", () => {
  it("keeps the requester's email out of the public booth", async () => {
    const r = await placeBooth(
      {
        company: "PT Contoh Maju",
        industry: "Teknologi",
        color: "#123456",
        contact: "Budi",
        email: "budi.pribadi@gmail.com",
        tier: "mini",
        price: 0,
        method: "Formulir",
        floor: 0,
        x: 0,
        y: 0,
      },
      "admin-1",
    );
    expect("booth" in r && r.booth.email).toBeUndefined();
    const data = stored.doc!.data as { booth: Record<string, unknown>; booking: { email: string } };
    expect(data.booth.email).toBeUndefined();
    expect(JSON.stringify(data.booth)).not.toContain("budi.pribadi");
    // The organiser still has it, in the booking only admins see.
    expect(data.booking.email).toBe("budi.pribadi@gmail.com");
  });
});
