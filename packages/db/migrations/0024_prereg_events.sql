CREATE TABLE IF NOT EXISTS "prereg_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"start_date" text,
	"end_date" text,
	"location" text DEFAULT 'Online' NOT NULL,
	"about" text,
	"banner" text,
	"capacity" integer,
	"open" boolean DEFAULT false NOT NULL,
	"deadline" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prereg_events_capacity_ck" CHECK ("prereg_events"."capacity" is null or "prereg_events"."capacity" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prereg_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"data" jsonb NOT NULL,
	"user_id" uuid,
	"linked_at" timestamp with time zone,
	"welcomed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prereg_events" ADD CONSTRAINT "prereg_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prereg_registrations" ADD CONSTRAINT "prereg_registrations_event_id_prereg_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."prereg_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prereg_registrations" ADD CONSTRAINT "prereg_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prereg_events_slug_uq" ON "prereg_events" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prereg_registrations_once_uq" ON "prereg_registrations" USING btree ("event_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prereg_registrations_code_uq" ON "prereg_registrations" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prereg_registrations_email_idx" ON "prereg_registrations" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prereg_registrations_user_idx" ON "prereg_registrations" USING btree ("user_id");--> statement-breakpoint
-- Locked like every other table (see 0003): registrants' contact details never reach Supabase's API roles.
ALTER TABLE "prereg_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prereg_registrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "prereg_events" FROM anon, authenticated;
    REVOKE ALL ON "prereg_registrations" FROM anon, authenticated;
  END IF;
END $$;
