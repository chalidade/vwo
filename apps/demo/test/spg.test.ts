import { describe, expect, it } from "vitest";
import { DEMO_JOB_FAIR, fairFloorId, vipSeats } from "@vwo/shared";
import { DemoJobFair, PLAYER_ID, spgHome, spgId } from "../src/jobfair-engine";

describe("VIP booth SPG", () => {
  it("walks over and sits next to whoever takes the lounge, then goes back to the gate", () => {
    const fair = new DemoJobFair(() => 0.5);
    const b = DEMO_JOB_FAIR.booths.find((x) => x.tier === "premium")!;
    const spg = () => fair.staff.find((s) => s.id === spgId(b.id))!;
    expect(spg()).toMatchObject({ floorId: fairFloorId(DEMO_JOB_FAIR, b.floor), ...spgHome(b) });
    const me = fair.join("Chalid", false, PLAYER_ID);
    const [a, other] = vipSeats(b);
    fair.changeFloor(me.memberId, fairFloorId(DEMO_JOB_FAIR, b.floor), a!.x, a!.y + 0.8);
    expect(fair.sit(me.memberId, a!.id)).toBeTruthy();
    for (let i = 0; i < 200 && !spg().seated; i++) fair.tick(100);
    expect(spg()).toMatchObject({ seated: true, x: other!.x, y: other!.y });
    fair.stand(me.memberId);
    for (let i = 0; i < 200 && (spg().x !== spgHome(b).x || spg().y !== spgHome(b).y); i++) fair.tick(100);
    expect(spg()).toMatchObject({ seated: false, ...spgHome(b) });
  });
});
