import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>["db"];

export function createDb(url = process.env.DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo") {
  const sqlClient = postgres(url, { max: 10, onnotice: () => {} });
  const db = drizzle(sqlClient, { schema });
  return { db, close: () => sqlClient.end() };
}
