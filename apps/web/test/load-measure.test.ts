// Measures (no database): the size of the public setup with and without its pictures moved out, and
// the requests one visitor makes per minute before and after, for the server and for the CDN.
// Run: pnpm --filter @vwo/web exec vitest run test/load-measure.test.ts  (prints the tables)
import { randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const { buildState, extractMedia } = await import("../lib/state-view");
const { pollConfig } = await import("../lib/runtime-config");

/** A company's 160 px JPEG logo as the editor makes it (~7 KB, which is ~9.5 K characters as a data URL). */
const logo = () => `data:image/jpeg;base64,${randomBytes(7_000).toString("base64")}`;

function setup(companies: number) {
  const rows = [
    {
      key: "org",
      data: { removed: [], added: Array.from({ length: companies }, (_, i) => ({ id: `co-${i}`, company: `PT Contoh ${i}`, industry: "Teknologi", floor: 1 + (i % 3) })) },
      updatedAt: new Date(1),
    },
  ];
  for (let i = 0; i < companies; i++)
    rows.push({
      key: `company:co-${i}`,
      data: {
        profile: { name: `PT Contoh ${i}`, logo: logo(), about: "Perusahaan teknologi yang berkembang pesat. ".repeat(6) },
        jobs: Array.from({ length: 4 }, (_, j) => ({ id: `j${j}`, title: `Posisi ${j}`, description: "Tanggung jawab dan kualifikasi. ".repeat(10) })),
        invoices: [],
      } as never,
      updatedAt: new Date(2 + i),
    });
  return rows;
}

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

describe("measured", () => {
  it("the public setup is a fraction of its size once logos are served by hash", () => {
    const lines: string[] = ["| Perusahaan | Sebelum (JSON / gzip) | Sesudah (JSON / gzip) | Logo, sekali per browser |", "|---|---|---|---|"];
    for (const n of [20, 60, 120]) {
      const view = buildState(setup(n), { admin: false, mine: new Set() });
      const before = JSON.stringify(view);
      const { doc, media } = extractMedia(view, 4096);
      const after = JSON.stringify(doc);
      const pics = [...media.values()].reduce((s, v) => s + (v.length * 3) / 4, 0);
      lines.push(`| ${n} | ${kb(before.length)} / ${kb(gzipSync(before).length)} | ${kb(after.length)} / ${kb(gzipSync(after).length)} | ${kb(pics)} |`);
      expect(after.length).toBeLessThan(before.length / 4);
    }
    console.log(lines.join("\n"));
  });

  it("requests per minute of one visitor in the game, tab visible", () => {
    const c = pollConfig({});
    // Before: every pull went to the server; `cdn` marks what the CDN now answers for everyone.
    const rows: [string, number, number, boolean][] = [
      ["GET /state", 60 / 30, 60 / c.statePollSec, true],
      ["GET /prices (now inside /state)", 60 / 60, 0, true],
      ["GET /applications", 60 / 15, 60 / c.applicationsPollSec, false],
      ["GET /stats", 60 / 30, 60 / c.statsPollSec, true],
      ["POST /stats (when there are hits)", 60 / 15, 60 / c.statsSendSec, false],
      ["GET /progress", 60 / 45, 60 / c.progressPollSec, false],
      // Only when something changed: about 3 a minute in play (the audit's estimate), at most 15 before and 7.5 now.
      ["PUT /progress (~, when something changed)", 3, 3 * (4 / c.progressPushSec), false],
      ["GET /reviews", 60 / 60, 60 / c.reviewsPollSec, true],
      ["GET /friends", 60 / 90, 60 / c.friendsPollSec, false],
    ];
    const f = (n: number) => n.toFixed(2);
    const lines = ["| Request | Sebelum /menit | Sesudah /menit | Dijawab CDN |", "|---|---|---|---|"];
    for (const [name, b, a, cdn] of rows) lines.push(`| ${name} | ${f(b)} | ${f(a)} | ${cdn ? "ya" : "tidak"} |`);
    const sum = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + pick(r), 0);
    const before = sum((r) => r[1]);
    const after = sum((r) => r[2]);
    const origin = sum((r) => (r[3] ? 0 : r[2]));
    lines.push(`| **Total** | **${f(before)}** | **${f(after)}** | ke server: **${f(origin)}** |`);
    console.log(lines.join("\n"));
    expect(after).toBeLessThan(before / 2);
    // 1,500 visitors: function invocations per minute before and after (CDN answers counted once per region per lifetime).
    const cdnPerMin = 60 / 20 + 60 / 30 + 60 / 60;
    console.log(
      `1.500 pengunjung: sebelum ${Math.round(1500 * before)} request/menit ke server, sesudah ${Math.round(1500 * origin + cdnPerMin)} (+ ${Math.round(1500 * (after - origin))} dijawab CDN)`,
    );
  });
});
