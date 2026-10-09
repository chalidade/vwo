CREATE TABLE IF NOT EXISTS "fair_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"booth_key" text NOT NULL,
	"job_key" text NOT NULL,
	"status" text DEFAULT 'Terkirim' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fair_applications" ADD CONSTRAINT "fair_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fair_applications_once_uq" ON "fair_applications" USING btree ("user_id","booth_key","job_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fair_applications_booth_idx" ON "fair_applications" USING btree ("booth_key");--> statement-breakpoint
-- Locked like every other table (see 0003): only the app, as table owner, reads or writes it.
ALTER TABLE "fair_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "fair_applications" FROM anon, authenticated;
  END IF;
END $$;
