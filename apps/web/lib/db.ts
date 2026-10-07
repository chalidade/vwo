import "server-only";
import { createDb, type Db } from "@vwo/db";

// Reuse one pool across hot reloads in development.
const g = globalThis as unknown as { __vwoDb?: Db };
export const db: Db = g.__vwoDb ?? createDb().db;
if (process.env.NODE_ENV !== "production") g.__vwoDb = db;
