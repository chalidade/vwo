CREATE TABLE IF NOT EXISTS "fair_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref" text NOT NULL,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text,
	"checkout_url" text,
	"method" text,
	"paid_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fair_payments_kind_ck" CHECK ("fair_payments"."kind" in ('coins','registration','invoice')),
	CONSTRAINT "fair_payments_status_ck" CHECK ("fair_payments"."status" in ('pending','paid','expired','failed')),
	CONSTRAINT "fair_payments_amount_ck" CHECK ("fair_payments"."amount" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fair_payments" ADD CONSTRAINT "fair_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fair_payments_user_idx" ON "fair_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fair_payments_ref_idx" ON "fair_payments" USING btree ("kind","ref");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fair_payments_provider_uq" ON "fair_payments" USING btree ("provider","provider_id");--> statement-breakpoint
-- Locked like every other table (see 0003).
ALTER TABLE "fair_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "fair_payments" FROM anon, authenticated;
  END IF;
END $$;
