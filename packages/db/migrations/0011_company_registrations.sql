CREATE TABLE IF NOT EXISTS "company_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company" text NOT NULL,
	"industry" text NOT NULL,
	"color" text NOT NULL,
	"website" text,
	"city" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_role" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"tier" text NOT NULL,
	"price" integer NOT NULL,
	"method" text,
	"status" text DEFAULT 'unpaid' NOT NULL,
	"paid_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"booth_key" text,
	"pin" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_registrations_status_ck" CHECK ("company_registrations"."status" in ('unpaid','paid','verified','rejected'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_registrations" ADD CONSTRAINT "company_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_registrations" ADD CONSTRAINT "company_registrations_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_registrations_user_idx" ON "company_registrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_registrations_status_idx" ON "company_registrations" USING btree ("status");--> statement-breakpoint
-- Locked like every other table (see 0003).
ALTER TABLE "company_registrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "company_registrations" FROM anon, authenticated;
  END IF;
END $$;
