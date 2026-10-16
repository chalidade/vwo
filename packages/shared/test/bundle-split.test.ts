import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The browser imports @vwo/shared too. zod only belongs in the *-schema.ts files (and auth.ts, which
// the browser never uses), so a page that needs a list or a helper doesn't download the validator.
const SRC = fileURLToPath(new URL("../src", import.meta.url));
const ZOD_OK = (f: string) => f.endsWith("-schema.ts") || f === "auth.ts";

describe("shared package split", () => {
  it("keeps zod in the schema files", () => {
    const offenders = readdirSync(SRC)
      .filter((f) => f.endsWith(".ts") && !ZOD_OK(f))
      .filter((f) => /from "zod"/.test(readFileSync(join(SRC, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("lets a bundler drop unused modules", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.sideEffects).toBe(false);
  });
});
