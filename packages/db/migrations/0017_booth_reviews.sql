CREATE TABLE IF NOT EXISTS "fair_reviews" (
	"user_id" uuid NOT NULL,
	"booth_key" text NOT NULL,
	"stars" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fair_reviews_user_id_booth_key_pk" PRIMARY KEY("user_id","booth_key"),
	CONSTRAINT "fair_reviews_stars_ck" CHECK ("fair_reviews"."stars" between 1 and 5)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fair_reviews" ADD CONSTRAINT "fair_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fair_reviews_booth_idx" ON "fair_reviews" USING btree ("booth_key");--> statement-breakpoint
ALTER TABLE "fair_reviews" ENABLE ROW LEVEL SECURITY;