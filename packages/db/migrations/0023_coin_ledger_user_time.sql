CREATE INDEX IF NOT EXISTS "coin_ledger_user_time_idx" ON "coin_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
DROP INDEX IF EXISTS "coin_ledger_user_idx";
