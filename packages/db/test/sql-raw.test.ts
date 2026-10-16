// SQL injection guard: every query goes through drizzle's parameters. The only raw SQL is the short list
// below, each built from constants. A new sql.raw, sql.identifier or postgres.js .unsafe() fails this
// test until someone checks it can never carry what a browser sent and adds it here.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const DIRS = ["packages/db/src", "apps/web/app", "apps/web/lib", "apps/web/middleware.ts", "apps/realtime/src"];

/** file → the exact raw calls allowed in it. */
const ALLOWED: Record<string, string[]> = {
  // `key` is the literal type "interview" | "visit".
  "packages/db/src/reminders.ts": ["sql.raw(`'${key}'`)"],
  // CAP holds two number constants.
  "packages/db/src/fair-stats.ts": ["sql.raw(`(case excluded.what when 'sold' then ${CAP.sold} else ${CAP.view} end)`)"],
};

function files(path: string): string[] {
  const full = join(ROOT, path);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full).flatMap((f) => (f === "node_modules" || f.startsWith(".") ? [] : files(join(path, f))));
}

/** Each raw call with its argument, up to the matching parenthesis. */
function rawCalls(text: string) {
  const out: string[] = [];
  const re = /\b(?:sql\.raw|sql\.identifier|\.unsafe)\s*\(/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    let depth = 0;
    let end = m.index + m[0].length - 1;
    for (; end < text.length; end++) {
      if (text[end] === "(") depth++;
      else if (text[end] === ")" && --depth === 0) break;
    }
    out.push(text.slice(m.index, end + 1).replace(/^\./, ""));
  }
  return out;
}

describe("raw SQL", () => {
  const found = DIRS.flatMap(files)
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .flatMap((f) => rawCalls(readFileSync(f, "utf8")).map((call) => ({ file: relative(ROOT, f), call })));

  it("only the reviewed constant calls exist", () => {
    const unexpected = found.filter(({ file, call }) => !ALLOWED[file]?.includes(call));
    expect(unexpected).toEqual([]);
  });

  it("finds the reviewed calls, so the scan itself still works", () => {
    for (const [file, calls] of Object.entries(ALLOWED)) for (const call of calls) expect(found).toContainEqual({ file, call });
  });

  it("flags a raw call built from input", () => {
    expect(rawCalls("db.execute(sql.raw(`select * from users where email = '${email}'`))")).toEqual(["sql.raw(`select * from users where email = '${email}'`)"]);
    expect(rawCalls("client.unsafe(q)")).toEqual(["unsafe(q)"]);
  });
});
