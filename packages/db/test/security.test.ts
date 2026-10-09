// Database-level protections that must hold on Supabase (trial) and on plain Postgres (event).
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowAction, createDb, isTransactionPooler } from "../src";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);

beforeAll(async () => {
  // Stand in for Supabase's API roles, which exist before any migration runs there.
  await db.execute(sql`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  end $$`);
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  // Supabase grants its API roles everything in public by default; start from that.
  await db.execute(sql`grant usage on schema public to anon, authenticated`);
  await db.execute(sql`alter default privileges in schema public grant all on tables to anon, authenticated`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
});

afterAll(async () => {
  await close();
});

describe("public API lock", () => {
  it("turns on row level security for every table", async () => {
    const open = await db.execute<{ relname: string }>(sql`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(open.map((r) => r.relname)).toEqual([]);
  });

  it("leaves the anon role unable to read users or coins", async () => {
    for (const table of ["users", "sessions", "coin_ledger", "rate_limits"]) {
      const exists = await db.execute(sql`select to_regclass(${"public." + table}) as t`);
      expect(exists[0]?.t, table).toBeTruthy();
      const [row] = await db.execute<{ ok: boolean }>(sql`select has_table_privilege('anon', ${"public." + table}, 'select') as ok`);
      expect(row?.ok, table).toBe(false);
    }
  });

  it("still lets the app, as table owner, read and write", async () => {
    await db.execute(sql`insert into rate_limits (key, count, reset_at) values ('owner-check', 1, now())`);
    const rows = await db.execute(sql`select count(*)::int as n from rate_limits where key = 'owner-check'`);
    expect(Number(rows[0]?.n)).toBe(1);
  });
});

describe("rate limit", () => {
  it("allows up to the limit, then refuses until the window ends", async () => {
    const key = `login:ip:${Math.random()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await allowAction(db, key, 3, 60_000));
    expect(results).toEqual([true, true, true, false]);
    await db.execute(sql`update rate_limits set reset_at = now() - interval '1 second' where key = ${key}`);
    expect(await allowAction(db, key, 3, 60_000)).toBe(true);
  });

  it("counts correctly when many requests arrive at once", async () => {
    const key = `burst:${Math.random()}`;
    const results = await Promise.all(Array.from({ length: 12 }, () => allowAction(db, key, 5, 60_000)));
    expect(results.filter(Boolean)).toHaveLength(5);
  });
});

describe("connection", () => {
  it("recognises Supabase's transaction pooler", () => {
    expect(isTransactionPooler("postgres://u:p@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres")).toBe(true);
    expect(isTransactionPooler("postgres://u:p@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres")).toBe(false);
  });
});
