CREATE TABLE IF NOT EXISTS "fair_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"job_title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fair_stats" (
	"key" text NOT NULL,
	"what" text NOT NULL,
	"user_id" uuid NOT NULL,
	"day" text NOT NULL,
	"n" integer DEFAULT 0 NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fair_stats_key_what_user_id_day_pk" PRIMARY KEY("key","what","user_id","day"),
	CONSTRAINT "fair_stats_what_ck" CHECK ("fair_stats"."what" in ('view', 'click', 'sold'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fair_events" ADD CONSTRAINT "fair_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fair_stats" ADD CONSTRAINT "fair_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fair_events_created_idx" ON "fair_events" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "fair_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fair_events" ENABLE ROW LEVEL SECURITY;