import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>["db"];

/** Supabase's transaction pooler (port 6543) cannot keep prepared statements between queries. */
export const isTransactionPooler = (url: string) => /:6543(\/|$)/.test(url);

export function createDb(url = process.env.DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo") {
  const sqlClient = postgres(url, {
    // Vercel's fluid compute serves several requests at once per instance: a few connections, so
    // one slow query doesn't queue every other request behind it.
    max: process.env.VERCEL ? 4 : 10,
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
