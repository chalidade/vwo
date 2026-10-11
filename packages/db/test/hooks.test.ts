// A booth's ATS webhook: secret handling, delivery records, signatures and the SSRF guard.
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boothHook, checkHookUrl, createDb, deleteBoothHook, isPublicAddress, recordBoothHookDelivery, rotateBoothHookSecret, setBoothHook, signBoothHook } from "../src";
import { users } from "../src/schema";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);
let hr: string;

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  [{ id: hr }] = (await db.insert(users).values({ email: "hr@pt.example", displayName: "HR" }).returning({ id: users.id })) as [{ id: string }];
});

afterAll(async () => {
  await close();
});

describe("booth webhook", () => {
  it("makes the secret on the first save only, and keeps it when the URL changes", async () => {
    const first = await setBoothHook(db, { boothKey: "pt-a", url: "https://ats.example.com/a", enabled: true, userId: hr });
    expect(first.secret).toMatch(/^whsec_[\w-]{40,}$/);
    const second = await setBoothHook(db, { boothKey: "pt-a", url: "https://ats.example.com/b", enabled: false, userId: hr });
    expect(second.secret).toBeUndefined();
    const row = await boothHook(db, "pt-a");
    expect(row).toMatchObject({ url: "https://ats.example.com/b", enabled: false, secret: first.secret });
  });

  it("rotates the secret, records deliveries and deletes", async () => {
    const before = (await boothHook(db, "pt-a"))!.secret;
    const fresh = await rotateBoothHookSecret(db, "pt-a", hr);
    expect(fresh).not.toBe(before);
    expect((await boothHook(db, "pt-a"))!.secret).toBe(fresh);
    expect(await rotateBoothHookSecret(db, "nobody", hr)).toBeNull();
    await recordBoothHookDelivery(db, "pt-a", 202);
    const row = await boothHook(db, "pt-a");
    expect(row!.lastStatus).toBe(202);
    expect(row!.lastAt).toBeInstanceOf(Date);
    expect(await deleteBoothHook(db, "pt-a")).toBe(true);
    expect(await boothHook(db, "pt-a")).toBeNull();
    expect(await deleteBoothHook(db, "pt-a")).toBe(false);
  });
});

describe("webhook signature", () => {
  it("is HMAC-SHA256 of timestamp.body, hex", () => {
    const body = '{"event":"test"}';
    const want = createHmac("sha256", "whsec_x").update(`1700000000.${body}`).digest("hex");
    expect(signBoothHook("whsec_x", 1700000000, body)).toBe(`sha256=${want}`);
    expect(signBoothHook("whsec_x", 1700000001, body)).not.toBe(`sha256=${want}`);
  });
});

describe("SSRF guard", () => {
  it("refuses loopback, private, link-local, metadata and reserved addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.100.100.200",
      "0.0.0.0",
      "224.0.0.1",
      "255.255.255.255",
      "::1",
      "::",
      "fe80::1",
      "fd00:ec2::254",
      "fc00::1",
      "::ffff:127.0.0.1",
      "::ffff:169.254.169.254",
      "64:ff9b::a9fe:a9fe",
      "2002:7f00:1::",
      "2001:db8::1",
      "not-an-ip",
    ])
      expect(isPublicAddress(ip), ip).toBe(false);
  });

  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111", "2a00:1450:4001::200e"]) expect(isPublicAddress(ip), ip).toBe(true);
  });

  it("accepts only https URLs to public hosts", () => {
    expect(checkHookUrl("https://ats.example.com/hook")).toHaveProperty("url");
    expect(checkHookUrl("http://ats.example.com/hook")).toEqual({ error: "https_only" });
    expect(checkHookUrl("ftp://x.example")).toEqual({ error: "https_only" });
    expect(checkHookUrl("nonsense")).toEqual({ error: "invalid_url" });
    expect(checkHookUrl("https://user:pw@ats.example.com/")).toEqual({ error: "invalid_url" });
    expect(checkHookUrl(`https://a.example/${"x".repeat(500)}`)).toEqual({ error: "invalid_url" });
    for (const bad of [
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://[::1]/x",
      "https://169.254.169.254/latest",
      "https://intranet/x",
      "https://printer.local/x",
      "https://metadata.google.internal/x",
      "https://0x7f000001/x",
      "https://2130706433/x",
    ])
      expect(checkHookUrl(bad), bad).toEqual({ error: "url_not_allowed" });
  });
});
