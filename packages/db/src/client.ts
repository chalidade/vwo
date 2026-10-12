import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>["db"];

/** Supabase's transaction pooler (port 6543) cannot keep prepared statements between queries. */
export const isTransactionPooler = (url: string) => /:6543(\/|$)/.test(url);

/**
 * Connections per instance. Every Vercel instance opens its own pool, and Supabase's pooler takes a
 * fixed number of clients (200 on Free/Nano), so a busy day with dozens of instances must stay
 * small: DB_POOL_MAX (default 3 on Vercel, 10 elsewhere), between 1 and 20.
 */
export function poolMax(env: Record<string, string | undefined> = process.env) {
  const n = Number(env.DB_POOL_MAX);
  if (env.DB_POOL_MAX && Number.isInteger(n) && n >= 1) return Math.min(n, 20);
  return env.VERCEL ? 3 : 10;
}

export function createDb(url = process.env.DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo") {
  const sqlClient = postgres(url, {
    // Vercel's fluid compute serves several requests at once per instance: a few connections, so
    // one slow query doesn't queue every other request behind it, but few enough for the pooler.
    max: poolMax(),
    // A frozen serverless instance can wake up holding a socket the pooler already closed; drop
    // idle and old connections early and give up on a connect quickly instead of hanging.
    idle_timeout: 20,
    max_lifetime: 60 * 5,
    connect_timeout: 10,
    prepare: !isTransactionPooler(url),
    onnotice: () => {},
  });
  const db = drizzle(sqlClient, { schema });
  return { db, close: () => sqlClient.end() };
}
