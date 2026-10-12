// The game's public runtime limits: read from env, cacheable, and never anything secret.
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/jobfair/config/route";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("GET /api/jobfair/config", () => {
  it("serves the stage limits from env, cached at the CDN", async () => {
    process.env.STAGE_MESH_MAX_VIEWERS = "5";
    process.env.STAGE_CHAT_ENABLED = "0";
    const res = GET();
    expect(res.headers.get("cache-control")).toContain("s-maxage=60");
    const body = (await res.json()) as { stage: { meshMaxViewers: number; chatEnabled: boolean; beatSec: number } };
    expect(body.stage).toMatchObject({ meshMaxViewers: 5, chatEnabled: false, beatSec: 10 });
  });

  it("carries no secrets", async () => {
    process.env.DATABASE_URL = "postgres://secret-db";
    process.env.XENDIT_SECRET_KEY = "xnd_secret";
    const text = JSON.stringify(await GET().json());
    expect(text).not.toContain("secret");
    expect(text).not.toContain("postgres");
  });
});
