import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { createDb } from "./client";

// Migrations need a session connection; on Supabase that is the direct URL or the session pooler (5432).
const { db, close } = createDb(process.env.MIGRATE_DATABASE_URL || undefined);
await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
await close();
console.log("migrations applied");
