import { describe, expect, it, vi } from "vitest";
import type { SeminarSession } from "../src/fair/content";
import { parseStage } from "../src/fair/stage";
import { scheduledStreams, streamFor } from "../src/fair/stage-now";
import type { AulaEvent } from "../src/jobfair-engine";

// The game loop and its shared state are not needed: every call here gets its sessions and rundown.
vi.mock("../src/useFair", () => ({ fair: {} }));

const YT = "https://youtu.be/dQw4w9WgXcQ";
const NOW = Date.UTC(2026, 9, 12, 3, 30);
const sem = (patch: Partial<SeminarSession>): SeminarSession => ({
  id: "cv",
  title: "CV",
  speaker: "Kak Nadia",
  role: "TA Lead",
  slides: [],
  startAt: NOW - 600_000,
  minutes: 60,
  ...patch,
});
const clock = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
};
const ev = (patch: Partial<AulaEvent>): AulaEvent => ({
  id: "buka",
  start: clock(NOW - 600_000),
  end: clock(NOW + 600_000),
  title: "Sambutan",
  host: "Ketua",
  kind: "sambutan",
  ...patch,
});

describe("stage messages", () => {
  it("reads the new on-air fields and the full notice, clamped", () => {
    const on = parseStage({ type: "on", sessionId: "cv", embed: true, full: true, every: 999, url: "https://evil.example" });
    expect(on).toMatchObject({ type: "on", embed: true, full: true, every: 60 });
    expect(on).not.toHaveProperty("url");
    expect(parseStage({ type: "on", sessionId: "cv" })).toMatchObject({ embed: undefined, full: undefined, every: 10 });
    expect(parseStage({ type: "full", to: "feed-abc" })).toEqual({ type: "full", to: "feed-abc" });
    expect(parseStage({ type: "full", to: "bad id!" })).toBeNull();
  });
});

describe("stream links by the schedule", () => {
  it("plays only items set to YouTube with a valid link, while they are on", () => {
    expect(scheduledStreams([sem({ streamSource: "link", streamUrl: YT })], [], NOW).seminar).toMatchObject({ sessionId: "cv", embed: true, scheduled: true, venue: "seminar" });
    // Platform chosen, no link, a broken link, or not on now: nothing plays by itself.
    expect(scheduledStreams([sem({ streamUrl: YT })], [], NOW).seminar).toBeNull();
    expect(scheduledStreams([sem({ streamSource: "link" })], [], NOW).seminar).toBeNull();
    expect(scheduledStreams([sem({ streamSource: "link", streamUrl: "https://evil.example/x" })], [], NOW).seminar).toBeNull();
    expect(scheduledStreams([sem({ streamSource: "link", streamUrl: YT, startAt: NOW + 3_600_000 })], [], NOW).seminar).toBeNull();
    expect(scheduledStreams([], [ev({ streamSource: "link", streamUrl: YT })], NOW).aula).toMatchObject({ sessionId: "aula-buka", venue: "aula", embed: true });
    expect(scheduledStreams([], [ev({ streamUrl: YT })], NOW).aula).toBeNull();
  });

  it("finds a broadcast's link from the organiser's setup, never from the message", () => {
    expect(streamFor({ sessionId: "cv", venue: "seminar" }, [sem({ streamSource: "link", streamUrl: YT })], [])?.provider).toBe("youtube");
    expect(streamFor({ sessionId: "aula-buka", venue: "aula" }, [], [ev({ streamSource: "link", streamUrl: YT })])?.provider).toBe("youtube");
    expect(streamFor({ sessionId: "cv", venue: "seminar" }, [sem({ streamSource: "link" })], [])).toBeNull();
  });
});
