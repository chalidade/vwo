// The company invoice list stays inside its booth, and announcements change only through admins.
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({ current: null as null | { id: string; email: string; name: string; role: string; earlyOrganizer?: boolean } }));
const db = vi.hoisted(() => ({
  invoicesOf: vi.fn(),
  isBoothMember: vi.fn(),
  updateFairStateLocked: vi.fn(),
  readFairStateKey: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ currentUser: async () => user.current }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/ratelimit", () => ({ allow: async () => true }));
vi.mock("@/lib/invoices", () => ({
  backfillInvoices: async () => {},
  invoiceOut: (r: unknown) => r,
  readBuyer: async () => null,
  readSeller: async () => ({ name: "", address: "", npwp: "", email: "", phone: "", pkp: false, ppnRate: 11, bank: { name: "", account: "", holder: "" } }),
}));
vi.mock("@vwo/db", async (orig) => ({
  ...(await orig<typeof import("@vwo/db")>()),
  invoicesOf: db.invoicesOf,
  isBoothMember: (_db: unknown, userId: string, booth: string) => db.isBoothMember(userId, booth),
  updateFairStateLocked: db.updateFairStateLocked,
  readFairStateKey: db.readFairStateKey,
}));

const invoices = await import("../app/api/invoices/route");
const announce = await import("../app/api/jobfair/announcements/route");

const list = (booth?: string) => invoices.GET(new Request(`https://jobfair.co.id/api/invoices${booth ? `?booth=${booth}` : ""}`));
const post = (body: unknown) =>
  announce.POST(
    new Request("https://jobfair.co.id/api/jobfair/announcements", {
      method: "POST",
      headers: { origin: "https://jobfair.co.id", host: "jobfair.co.id", "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  process.env.ADMIN_EMAILS = "panitia@jobfair.co.id";
  user.current = null;
  db.invoicesOf.mockReset().mockResolvedValue([]);
  db.isBoothMember.mockReset().mockImplementation(async (userId: string, booth: string) => userId === "alice" && booth === "booth-a");
  db.updateFairStateLocked.mockReset().mockImplementation(async (_db: unknown, _key: string, _user: string, change: (d: unknown) => unknown) => change(null));
  db.readFairStateKey.mockReset().mockResolvedValue(null);
});

describe("GET /api/invoices", () => {
  it("lists a booth's invoices only to that booth's members", async () => {
    user.current = { id: "alice", email: "alice@a.example", name: "Alice", role: "user" };
    expect((await list("booth-a")).status).toBe(200);
    expect(db.invoicesOf).toHaveBeenLastCalledWith({}, "alice", { booth: "booth-a" });
    const r = await list("booth-b");
    expect(r.status).toBe(403);
    expect(db.invoicesOf).toHaveBeenCalledTimes(1);
  });

  it("lists only the account's own invoices without a booth", async () => {
    user.current = { id: "alice", email: "alice@a.example", name: "Alice", role: "user" };
    await list();
    expect(db.invoicesOf).toHaveBeenLastCalledWith({}, "alice", "personal");
  });

  it("refuses a malformed booth and a visitor", async () => {
    user.current = { id: "alice", email: "alice@a.example", name: "Alice", role: "user" };
    expect((await list("../x")).status).toBe(403);
    user.current = null;
    expect((await list("booth-a")).status).toBe(401);
  });
});

describe("POST /api/jobfair/announcements", () => {
  it("is for event admins only", async () => {
    user.current = { id: "c1", email: "hr@a.example", name: "HR", role: "user" };
    expect((await post({ op: "post", text: "halo" })).status).toBe(403);
    expect(db.updateFairStateLocked).not.toHaveBeenCalled();
  });

  it("posts, and takes the old setup's announcement as the starting board", async () => {
    user.current = { id: "a1", email: "panitia@jobfair.co.id", name: "Panitia", role: "user" };
    db.readFairStateKey.mockResolvedValue({ data: { announcement: { text: "lama", at: 5 } } });
    const r = await post({ op: "hide" });
    expect(r.status).toBe(200);
    expect((await r.json()).board).toEqual({ current: null, history: [{ id: "a5", text: "lama", at: 5 }] });
    const p = await post({ op: "post", text: "baru" });
    const board = (await p.json()).board;
    expect(board.history.map((a: { text: string }) => a.text)).toEqual(["baru", "lama"]);
    expect(board.current).toBe(board.history[0].id);
  });

  it("refuses text that is too long or an unknown step", async () => {
    user.current = { id: "a1", email: "panitia@jobfair.co.id", name: "Panitia", role: "user" };
    expect((await post({ op: "post", text: "x".repeat(201) })).status).toBe(400);
    expect((await post({ op: "wipe" })).status).toBe(400);
  });
});
