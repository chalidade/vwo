import { describe, expect, it } from "vitest";
import {
  BOT_CONSULTANTS,
  CONSULT_DESKS,
  type ConsultantDoc,
  type ConsultantProfile,
  type ConsultChange,
  type ConsultSnapshot,
  consultOps,
  consultSnapshot,
  freeConsultDesks,
  loungeConsultants,
  publicConsultant,
} from "../src";

const profile: ConsultantProfile = { name: "Kak Rani", role: "Konsultan karier", topics: ["Review CV"], emoji: "🧭", color: "#2563eb" };
const doc = (id: string, desk: number, by = `u-${id}`): ConsultantDoc => ({ id, desk, profile, via: "panitia", by, email: `${id}@x.id`, phone: "0812345678", at: 1 });
const allBotsOff = BOT_CONSULTANTS.map((b) => b.id);

/** Apply a decision's writes to a snapshot, as the server and the demo do. */
function applied(s: ConsultSnapshot, c: ConsultChange<unknown>): ConsultSnapshot {
  if ("error" in c) throw new Error(c.error);
  const rows = new Map<string, unknown>([
    ...s.placed.map((p) => [`consultant:${p.id}`, p] as const),
    ...s.requests.map((r) => [`conreq:${r.userId}`, r] as const),
    ["consultcfg", { botsOff: s.botsOff }] as const,
  ]);
  for (const d of c.put ?? []) rows.set(d.key, d.data);
  for (const k of c.del ?? []) rows.delete(k);
  return consultSnapshot([...rows].map(([key, data]) => ({ key, data })));
}
const empty = (botsOff: string[] = allBotsOff): ConsultSnapshot => ({ placed: [], requests: [], botsOff });

describe("lounge desks", () => {
  it("seats the published bots at their desks, and frees a desk when its bot is off", () => {
    expect(BOT_CONSULTANTS).toHaveLength(CONSULT_DESKS);
    expect(freeConsultDesks(BOT_CONSULTANTS, [], [])).toEqual([]);
    expect(freeConsultDesks(BOT_CONSULTANTS, [BOT_CONSULTANTS[1]!.id], [])).toEqual([1]);
    expect(freeConsultDesks(BOT_CONSULTANTS, allBotsOff, [doc("a", 2)])).toEqual([0, 1, 3]);
  });

  it("puts a real consultant at their desk instead of the bot, with the desk on each consultant", () => {
    const list = loungeConsultants(BOT_CONSULTANTS, [publicConsultant(doc("a", 1), 0)], [BOT_CONSULTANTS[1]!.id, BOT_CONSULTANTS[3]!.id]);
    expect(list.map((c) => [c.desk, c.id, !!c.live])).toEqual([
      [0, BOT_CONSULTANTS[0]!.id, false],
      [1, "a", true],
      [2, BOT_CONSULTANTS[2]!.id, false],
    ]);
    // A bot switched back on whose desk is taken stays away.
    expect(
      loungeConsultants(BOT_CONSULTANTS, [publicConsultant(doc("a", 1), 0)], [])
        .filter((c) => c.desk === 1)
        .map((c) => c.id),
    ).toEqual(["a"]);
  });

  it("shows visitors only the public profile, never who owns the desk or how to reach them", () => {
    const pub = publicConsultant({ ...doc("a", 0), paymentId: "pay-1", openUntil: 5000, profile: { ...profile, bio: "Halo" } }, 1000);
    expect(pub).toEqual({ id: "a", desk: 0, via: "panitia", open: true, profile: { ...profile, bio: "Halo" } });
    const text = JSON.stringify(pub);
    for (const secret of ["u-a", "a@x.id", "0812345678", "pay-1"]) expect(text).not.toContain(secret);
    expect(publicConsultant({ ...doc("a", 0), openUntil: 5000 }, 6000).open).toBe(false);
  });
});

describe("consultOps", () => {
  it("approves an application onto a free desk only, and never gives one account two desks", () => {
    let s = applied(empty(), consultOps.apply(empty(), { userId: "u1", email: "a@x.id", phone: "0812345678", profile }, 1));
    expect(s.requests[0]!.status).toBe("pending");
    // Desk 0 still has its bot when bots are on.
    expect(consultOps.approve({ ...s, botsOff: [] }, "u1", 0, "k1", 2)).toEqual({ error: "desk_taken" });
    s = applied(s, consultOps.approve(s, "u1", 2, "k1", 2));
    expect(s.placed).toMatchObject([{ id: "k1", desk: 2, by: "u1", via: "panitia" }]);
    expect(s.requests[0]).toMatchObject({ status: "approved", consultantId: "k1" });
    expect(consultOps.approve(s, "u1", 3, "k2", 3)).toEqual({ error: "not_pending" });
    expect(consultOps.apply(s, { userId: "u1", email: "a@x.id", phone: "0812345678", profile }, 4)).toEqual({ error: "has_desk" });
    // Someone else can't get desk 2 now.
    s = applied(s, consultOps.apply(s, { userId: "u2", email: "b@x.id", phone: "0812345679", profile }, 5));
    expect(consultOps.approve(s, "u2", 2, "k2", 6)).toEqual({ error: "desk_taken" });
  });

  it("seats a paid slot once, moves it to a free desk when its pick was taken, and refuses a full lounge", () => {
    let s = applied(empty(), consultOps.placePaid(empty(), { id: "p1", userId: "u1", meta: { desk: 1, profile } }, "k1", 1));
    expect(s.placed).toMatchObject([{ id: "k1", desk: 1, via: "slot", paymentId: "p1" }]);
    // The same payment again: the same desk, nothing new written.
    const again = consultOps.placePaid(s, { id: "p1", userId: "u1", meta: { desk: 1, profile } }, "k9", 2);
    expect(again).toEqual({ result: s.placed[0] });
    expect(consultOps.placePaid(s, { id: "p2", userId: "u1", meta: { desk: 0, profile } }, "k2", 2)).toEqual({ error: "has_desk" });
    s = applied(s, consultOps.placePaid(s, { id: "p3", userId: "u3", meta: { desk: 1, profile } }, "k3", 3));
    expect(s.placed.find((p) => p.id === "k3")!.desk).toBe(0);
    s = applied(s, consultOps.placePaid(s, { id: "p4", userId: "u4", meta: { desk: 2, profile } }, "k4", 4));
    s = applied(s, consultOps.placePaid(s, { id: "p5", userId: "u5", meta: { desk: 3, profile } }, "k5", 5));
    expect(consultOps.placePaid(s, { id: "p6", userId: "u6", meta: { desk: 3, profile } }, "k6", 6)).toEqual({ error: "full" });
  });

  it("frees the desk when the organiser removes a consultant, and only touches known bots", () => {
    let s = applied(empty(), consultOps.apply(empty(), { userId: "u1", email: "a@x.id", phone: "0812345678", profile }, 1));
    s = applied(s, consultOps.approve(s, "u1", 0, "k1", 2));
    s = applied(s, consultOps.remove(s, "k1", 3));
    expect(s.placed).toEqual([]);
    expect(s.requests[0]!.status).toBe("removed");
    expect(consultOps.remove(s, "k1", 4)).toEqual({ error: "not_found" });
    expect(consultOps.botsOff(s, ["nope", BOT_CONSULTANTS[0]!.id, BOT_CONSULTANTS[0]!.id])).toMatchObject({ result: [BOT_CONSULTANTS[0]!.id] });
  });

  it("lets only the owner change the profile or open the desk", () => {
    const s: ConsultSnapshot = { ...empty(), placed: [doc("k1", 0, "u1")] };
    expect(consultOps.profile(s, "u2", profile)).toEqual({ error: "not_found" });
    expect(consultOps.open(s, "u2", true, 0)).toEqual({ error: "not_found" });
    const opened = consultOps.open(s, "u1", true, 1000);
    expect("result" in opened && opened.result.openUntil).toBeGreaterThan(1000);
    const closed = consultOps.open(s, "u1", false, 1000);
    expect("result" in closed && closed.result.openUntil).toBe(0);
  });
});
