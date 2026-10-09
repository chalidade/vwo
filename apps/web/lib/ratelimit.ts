import "server-only";
import { allowAction } from "@vwo/db";
import { db } from "./db";

/** True when `key` may do one more action: at most `limit` per `windowMs`, counted in Postgres so
 *  every instance and serverless function shares the same window. */
export const allow = (key: string, limit: number, windowMs: number) => allowAction(db, key, limit, windowMs);
