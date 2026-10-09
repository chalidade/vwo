CREATE TABLE IF NOT EXISTS "early_access" (
	"email" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"booth_key" text,
	"note" text,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "early_access_role_ck" CHECK ("early_access"."role" in ('seeker','company'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "early_access" ADD CONSTRAINT "early_access_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Locked like every other table (see 0003).
ALTER TABLE "early_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "early_access" FROM anon, authenticated;
  END IF;
END $$;
