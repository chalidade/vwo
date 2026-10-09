CREATE TABLE IF NOT EXISTS "fair_booth_members" (
	"booth_key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fair_booth_members_booth_key_user_id_pk" PRIMARY KEY("booth_key","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fair_booth_members" ADD CONSTRAINT "fair_booth_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fair_booth_members_user_idx" ON "fair_booth_members" USING btree ("user_id");--> statement-breakpoint
-- Locked like every other table (see 0003).
ALTER TABLE "fair_booth_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "fair_booth_members" FROM anon, authenticated;
  END IF;
END $$;
