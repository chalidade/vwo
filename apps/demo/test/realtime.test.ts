import { describe, expect, it } from "vitest";
import { closeChannel, openChannel } from "../src/realtime";

describe("realtime channels", () => {
  it("waits for a channel of the same name to finish leaving before joining it again", async () => {
    const log: string[] = [];
    let done!: () => void;
    const sb = {
      channel: (name: string) => (log.push(`open ${name}`), { unsubscribe: async () => {} }),
      removeChannel: () => new Promise<void>((r) => (done = () => (log.push("left"), r()))),
    } as never;
    closeChannel(sb, "jobfair:x", { unsubscribe: async () => {} });
    const again = openChannel(sb, "jobfair:x", { config: {} });
    const other = openChannel(sb, "jobfair:y", { config: {} });
    await other;
    expect(log).toEqual(["open jobfair:y"]);
    done();
    await again;
    expect(log).toEqual(["open jobfair:y", "left", "open jobfair:x"]);
  });
});
