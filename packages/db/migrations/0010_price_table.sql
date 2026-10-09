CREATE TABLE IF NOT EXISTS "fair_prices" (
	"key" text PRIMARY KEY NOT NULL,
	"amount" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "fair_prices_amount_ck" CHECK ("fair_prices"."amount" >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fair_prices" ADD CONSTRAINT "fair_prices_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Locked like every other table (see 0003).
ALTER TABLE "fair_prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "fair_prices" FROM anon, authenticated;
  END IF;
END $$;
