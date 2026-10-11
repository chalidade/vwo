// The organiser's "move a stand" route: only event admins may move stands, and only with a valid floor and slot.
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({ current: null as null | { id: string; email: string; role: string; earlyOrganizer?: boolean } }));
const moveStand = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ currentUser: async () => user.current }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/ratelimit", () => ({ allow: async () => true }));
vi.mock("@/lib/booths", () => ({ moveStand }));

const { POST } = await import("../app/api/jobfair/booths/[booth]/place/route");

const call = (body: unknown, origin = "https://jobfair.co.id", booth = "nusantara-tech") =>
  POST(
    new Request(`https://jobfair.co.id/api/jobfair/booths/${booth}/place`, {
      method: "POST",
      headers: { origin, host: "jobfair.co.id", "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    {
      params: Promise.resolve({ booth }),
    },
  );

describe("POST /api/jobfair/booths/[booth]/place", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = "panitia@jobfair.co.id";
    user.current = null;
    moveStand.mockReset();
    moveStand.mockResolvedValue({ placements: { "nusantara-tech": { floor: 1, x: 20, y: 0.4 } }, swapped: null });
  });

  it("asks a visitor to sign in", async () => {
    const r = await call({ floor: 1, slot: 2 });
    expect(r.status).toBe(401);
    expect(moveStand).not.toHaveBeenCalled();
  });

  it("refuses a signed-in company account or job seeker", async () => {
    user.current = { id: "u1", email: "hr@nusantaratech.example", role: "user" };
    const r = await call({ floor: 1, slot: 2 });
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: "not_allowed" });
    expect(moveStand).not.toHaveBeenCalled();
  });

  it("refuses a request from another site, even an admin's", async () => {
    user.current = { id: "a1", email: "panitia@jobfair.co.id", role: "user" };
    const r = await call({ floor: 1, slot: 2 }, "https://evil.example");
    expect(r.status).toBe(403);
    expect(moveStand).not.toHaveBeenCalled();
  });

  it("lets an event admin or a panitia tester move a stand", async () => {
    user.current = { id: "a1", email: "panitia@jobfair.co.id", role: "user" };
    const r = await call({ floor: 1, slot: 2 });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, swapped: null });
    expect(moveStand).toHaveBeenCalledWith("nusantara-tech", { floor: 1, slot: 2 }, "a1");
    user.current = { id: "e1", email: "tester@example.com", role: "user", earlyOrganizer: true };
    expect((await call({ floor: 0, slot: 5 })).status).toBe(200);
  });

  it("checks the floor, the slot and the booth id before moving anything", async () => {
    user.current = { id: "a1", email: "panitia@jobfair.co.id", role: "super_admin" };
    for (const body of [{ floor: 1, slot: 6 }, { floor: -1, slot: 0 }, { floor: 1.5, slot: 0 }, { floor: 1 }, { floor: "1", slot: "2" }])
      expect((await call(body)).status).toBe(400);
    expect((await call({ floor: 1, slot: 0 }, undefined, "../../org")).status).toBe(404);
    expect(moveStand).not.toHaveBeenCalled();
    // What the move itself refuses comes back as is.
    moveStand.mockResolvedValueOnce({ error: "invalid_slot" });
    expect((await call({ floor: 9, slot: 0 })).status).toBe(400);
    moveStand.mockResolvedValueOnce({ error: "not_found" });
    expect((await call({ floor: 1, slot: 0 })).status).toBe(404);
  });
});
