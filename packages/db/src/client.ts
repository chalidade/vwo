import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>["db"];

/** Supabase's transaction pooler (port 6543) cannot keep prepared statements between queries. */
export const isTransactionPooler = (url: string) => /:6543(\/|$)/.test(url);

export function createDb(url = process.env.DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo") {
  const sqlClient = postgres(url, {
    // A serverless function (Vercel) serves one request at a time, so one connection is enough.
    max: process.env.VERCEL ? 1 : 10,
    prepare: !isTransactionPooler(url),
    onnotice: () => {},
  });
  const db = drizzle(sqlClient, { schema });
  return { db, close: () => sqlClient.end() };
}
