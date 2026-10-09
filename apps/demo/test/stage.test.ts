import { describe, expect, it } from "vitest";
import { parseStage, stageCallId } from "../src/fair/stage";

describe("stage messages from the public channel", () => {
  it("keeps well-formed messages and trims them", () => {
    const on = parseStage({ type: "on", sessionId: "s1", title: "x".repeat(500), speaker: "Rina", role: "HR", startedAt: 5, screen: true, slide: 3, viewers: 2, venue: "aula", extra: "dropped" });
    expect(on).toMatchObject({ type: "on", sessionId: "s1", speaker: "Rina", screen: true, slide: 3, venue: "aula" });
    expect((on as { title: string }).title).toHaveLength(160);
    expect(on).not.toHaveProperty("extra");
    expect(parseStage({ type: "chat", chat: { id: "c1", name: "A", text: "Halo", at: 1, bot: true } })).toEqual({ type: "chat", chat: { id: "c1", name: "A", text: "Halo", at: 1 } });
  });

  it("drops anything malformed", () => {
    expect(parseStage(null)).toBeNull();
    expect(parseStage({ type: "nuke" })).toBeNull();
    expect(parseStage({ type: "on", sessionId: "../../x" })).toBeNull();
    expect(parseStage({ type: "join", viewerId: "<img>", name: "x" })).toBeNull();
    expect(parseStage({ type: "chat", chat: { id: "c1", text: "   " } })).toBeNull();
    expect(parseStage({ type: "history", to: "v1", chat: "nope" })).toBeNull();
  });

  it("uses call ids the live signal channel accepts", () => {
    expect(stageCallId("player-ab12cd")).toMatch(/^call-[\w-]{1,64}$/);
  });
});
