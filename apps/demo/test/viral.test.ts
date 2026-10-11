import { describe, expect, it } from "vitest";
import { badgesOf, campusKey } from "../src/fair/viral";
import type { FairApplication, PlayerState } from "../src/jobfair-engine";

const player = (p: Partial<PlayerState> = {}): PlayerState => ({ coins: 0, txns: [], vouchers: [], tickets: [], xp: 0, psych: [], seminars: [], dailyOn: null, meals: 0, ...p });
const app = (status: FairApplication["status"]) => ({ status }) as FairApplication;

describe("badges", () => {
  it("earns badges from progress and lists earned ones first", () => {
    const b = badgesOf({
      applications: [app("Terkirim"), app("Diterima")],
      player: player({ seminars: ["s1"], psych: [{ score: 8, total: 10 } as PlayerState["psych"][number]] }),
      stamps: 3,
      booths: 18,
      psychPass: 0.7,
      friends: 3,
    });
    const got = b.filter((x) => x.got).map((x) => x.id);
    expect(got).toEqual(expect.arrayContaining(["first-apply", "hired", "psych", "learner", "ambassador"]));
    expect(got).not.toContain("explorer");
    expect(b.findIndex((x) => !x.got)).toBe(got.length);
  });

  it("gives nothing to a brand new player", () => {
    expect(badgesOf({ applications: [], player: player(), stamps: 0, booths: 0, psychPass: 0.7, friends: 0 }).some((x) => x.got)).toBe(false);
  });
});

describe("campus names", () => {
  it("treats spelling variants as one campus", () => {
    expect(campusKey(" I.T.B ")).toBe(campusKey("itb"));
    expect(campusKey("Universitas Indonesia")).toBe("universitasindonesia");
  });
});
