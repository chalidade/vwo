import { describe, expect, it } from "vitest";
import { STAGE_DEFAULTS, cleanStageConfig, cleanStreamUrl, meshAdmit, stageConfigFromEnv, stageSendWait, stageStaleMs, streamEmbed, usesStreamLink } from "../src";

const ID = "dQw4w9WgXcQ";
const CH = "UC" + "a".repeat(22);

describe("stream links", () => {
  it("embeds every YouTube link form from the provider's id", () => {
    for (const url of [
      `https://youtu.be/${ID}`,
      `https://www.youtube.com/watch?v=${ID}&t=30s`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://www.youtube.com/live/${ID}?si=abc`,
      `https://youtube.com/embed/${ID}`,
      `https://www.youtube.com/shorts/${ID}`,
      `youtube.com/watch?v=${ID}`,
      `  http://youtu.be/${ID}  `,
    ])
      expect(streamEmbed(url), url).toEqual({
        provider: "youtube",
        src: `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&playsinline=1&rel=0`,
        watch: `https://www.youtube.com/watch?v=${ID}`,
      });
  });

  it("plays a channel's current live stream", () => {
    expect(streamEmbed(`https://www.youtube.com/channel/${CH}/live`)?.src).toBe(`https://www.youtube-nocookie.com/embed/live_stream?channel=${CH}&autoplay=1&playsinline=1`);
  });

  it("embeds Vimeo videos, unlisted videos and live events", () => {
    expect(streamEmbed("https://vimeo.com/123456")?.src).toBe("https://player.vimeo.com/video/123456?autoplay=1&playsinline=1");
    expect(streamEmbed("https://vimeo.com/123456/abcdef1234")).toMatchObject({
      src: "https://player.vimeo.com/video/123456?autoplay=1&playsinline=1&h=abcdef1234",
      watch: "https://vimeo.com/123456/abcdef1234",
    });
    expect(streamEmbed("https://player.vimeo.com/video/42?h=abcdef12")?.src).toContain("&h=abcdef12");
    expect(streamEmbed("https://vimeo.com/event/998877")?.src).toBe("https://vimeo.com/event/998877/embed?autoplay=1");
  });

  it("refuses other hosts, look-alikes and anything that is not a video id", () => {
    for (const url of [
      "",
      "   ",
      "https://example.com/watch?v=" + ID,
      "https://youtube.com.evil.example/watch?v=" + ID,
      "https://evil-youtube.com/watch?v=" + ID,
      "https://youtu.be.evil.example/" + ID,
      "javascript:alert(1)//youtu.be/" + ID,
      "data:text/html,<script>alert(1)</script>",
      "ftp://youtu.be/" + ID,
      `https://user:pw@youtu.be/${ID}`,
      `https://youtu.be:8443/${ID}`,
      "https://youtu.be/short",
      `https://youtu.be/${ID}/extra`,
      `https://www.youtube.com/watch?v=${ID}"onload="x`,
      "https://www.youtube.com/watch",
      "https://www.youtube.com/@channel/live",
      "https://www.youtube.com/channel/UCshort/live",
      "https://vimeo.com/channels/staffpicks",
      "https://vimeo.com/123/<script>",
      "https://player.vimeo.com/video/abc",
      `https://youtu.be/${ID}?` + "x".repeat(400),
      null,
      42,
    ])
      expect(streamEmbed(url), String(url)).toBeNull();
  });

  it("keeps a valid link trimmed and drops an invalid one", () => {
    expect(cleanStreamUrl(`  https://youtu.be/${ID} `)).toBe(`https://youtu.be/${ID}`);
    expect(cleanStreamUrl("https://example.com/live")).toBeUndefined();
    expect(cleanStreamUrl(undefined)).toBeUndefined();
  });
});

describe("stage limits", () => {
  it("defaults for the free budget and reads env vars within range", () => {
    expect(stageConfigFromEnv({})).toEqual(STAGE_DEFAULTS);
    expect(STAGE_DEFAULTS.meshMaxViewers).toBe(8);
    expect(
      stageConfigFromEnv({
        STAGE_MESH_MAX_VIEWERS: "3",
        STAGE_BEAT_SEC: "1",
        STAGE_CHAT_ENABLED: "off",
        STAGE_CHAT_COOLDOWN_SEC: "abc",
        STAGE_REACT_COOLDOWN_SEC: "9999",
        STAGE_CHAT_BUDGET: "400",
      }),
    ).toEqual({ meshMaxViewers: 3, beatSec: 2, chatEnabled: false, chatCooldownSec: STAGE_DEFAULTS.chatCooldownSec, reactCooldownSec: 600, chatBudget: 400 });
    expect(stageConfigFromEnv({ STAGE_CHAT_ENABLED: "1" }).chatEnabled).toBe(true);
    expect(stageConfigFromEnv({ STAGE_MESH_MAX_VIEWERS: "0" }).meshMaxViewers).toBe(0);
  });

  it("cleans a config received over the network", () => {
    expect(cleanStageConfig(null)).toEqual(STAGE_DEFAULTS);
    expect(cleanStageConfig({ meshMaxViewers: -5, chatEnabled: "nope", beatSec: 12.4 })).toMatchObject({ meshMaxViewers: 0, chatEnabled: true, beatSec: 12 });
    expect(cleanStageConfig({ chatEnabled: false }).chatEnabled).toBe(false);
  });

  it("gives viewers a stale timeout of three beats", () => {
    expect(stageStaleMs(10)).toBe(32_000);
    expect(stageStaleMs(0)).toBe(8_000);
  });
});

describe("mesh cap", () => {
  it("admits viewers up to the cap and keeps those already in", () => {
    expect(meshAdmit([], "a", 2)).toBe(true);
    expect(meshAdmit(["a"], "b", 2)).toBe(true);
    expect(meshAdmit(["a", "b"], "c", 2)).toBe(false);
    expect(meshAdmit(["a", "b"], "b", 2)).toBe(true);
    expect(meshAdmit(new Set(["a"]), "a", 0)).toBe(true);
    expect(meshAdmit([], "a", 0)).toBe(false);
  });

  it("a crowd of 50 joining a cap of 8: exactly 8 streams, the rest get slides", () => {
    const inMesh: string[] = [];
    let full = 0;
    for (let i = 0; i < 50; i++) {
      const id = `v${i}`;
      if (meshAdmit(inMesh, id, 8)) inMesh.push(id);
      else full++;
    }
    expect(inMesh).toHaveLength(8);
    expect(full).toBe(42);
  });
});

describe("chat slow mode", () => {
  const base = { now: 100_000, last: 0, recent: [] as number[], watchers: 10, cooldownMs: 10_000, budget: 30 };

  it("lets a quiet room chat, with each viewer's own cooldown", () => {
    expect(stageSendWait(base)).toBe(0);
    expect(stageSendWait({ ...base, last: 95_000 })).toBe(5_000);
  });

  it("holds the room to budget / watchers messages per second", () => {
    // 200 watchers, 30/s budget: 1 message per 6.7 s, i.e. 1 in a 10 s window.
    expect(stageSendWait({ ...base, watchers: 200, recent: [96_000] })).toBe(6_000);
    expect(stageSendWait({ ...base, watchers: 200, recent: [89_000] })).toBe(0);
    // 10 watchers: 30 messages in 10 s are fine, the 31st waits.
    const busy = Array.from({ length: 30 }, (_, i) => 91_000 + i * 100);
    expect(stageSendWait({ ...base, recent: busy.slice(0, 29) })).toBe(0);
    expect(stageSendWait({ ...base, recent: busy })).toBe(1_000);
  });

  it("stretches the window when even one message a window is too many", () => {
    // 1000 watchers, 30/s: one message per 33.3 s.
    expect(stageSendWait({ ...base, watchers: 1000, recent: [90_000] })).toBe(23_334);
  });

  it("keeps a simulated busy room under budget", () => {
    // Every viewer of 150 tries to chat every second for two minutes; count delivered messages per second.
    const watchers = 150;
    const budget = 30;
    const sent: number[] = [];
    const last = new Map<number, number>();
    for (let t = 0; t < 120_000; t += 250)
      for (let v = 0; v < watchers; v += 7) {
        if (stageSendWait({ now: t, last: last.get(v) ?? -1e9, recent: sent, watchers, cooldownMs: 10_000, budget }) > 0) continue;
        sent.push(t);
        last.set(v, t);
      }
    const perSec = (sent.length * watchers) / 120;
    expect(perSec).toBeLessThanOrEqual(budget);
    expect(perSec).toBeGreaterThan(budget * 0.5);
  });
});

describe("stream source", () => {
  it("is the speaker's browser unless the organiser chose a link", () => {
    expect(usesStreamLink({ streamSource: "link" })).toBe(true);
    expect(usesStreamLink({})).toBe(false);
    expect(usesStreamLink({ streamSource: "platform" })).toBe(false);
    expect(usesStreamLink(null)).toBe(false);
  });
});

/**
 * Supabase Realtime messages per second for one live seminar, each receiver counted, before and after.
 * N players online (all subscribed to the stage channel before), W of them in the room watching,
 * one player arriving per second, 10% of watchers chatting every 30 s and everyone clapping every 20 s.
 * Before: one channel for everything, "on air" every 2 s, every arrival says hello and gets a beat back,
 * every chat and reaction reaches all N. After: "on air" every STAGE_BEAT_SEC (10 s) to N, no hello on
 * the live site, chat and reactions only to the W watchers and held to STAGE_CHAT_BUDGET by slow mode.
 */
function stageBudget(n: number, w: number) {
  const wantChat = (w * 0.1) / 30 + w / 20; // messages per second the watchers would like to send
  const before = n / 2 + 2 * n * 1 + wantChat * n;
  // After: simulate the slow mode for two minutes with every watcher trying at that rate.
  const sent: number[] = [];
  const last = new Map<number, number>();
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let t = 0; t < 120_000; t += 100)
    for (let v = 0; v < w; v++) {
      if (random() > (wantChat / w) * 0.1) continue;
      if (stageSendWait({ now: t, last: last.get(v) ?? -1e9, recent: sent, watchers: w, cooldownMs: 3_000, budget: STAGE_DEFAULTS.chatBudget }) > 0) continue;
      sent.push(t);
      last.set(v, t);
    }
  const after = n / STAGE_DEFAULTS.beatSec + (sent.length / 120) * w;
  return { before: Math.round(before), after: Math.round(after) };
}

describe("stage message budget (Supabase Free: 100/s for the whole project)", () => {
  it("fits one live seminar in a third of the budget", () => {
    for (const [n, w] of [
      [100, 40],
      [200, 100],
      [200, 190],
    ] as const) {
      const { before, after } = stageBudget(n, w);
      console.log(`stage: ${n} online, ${w} watching: before ${before} msg/s, after ${after} msg/s`);
      expect(after).toBeLessThanOrEqual(n / STAGE_DEFAULTS.beatSec + STAGE_DEFAULTS.chatBudget);
      expect(after).toBeLessThan(55);
      expect(before).toBeGreaterThan(300);
    }
  });
});
