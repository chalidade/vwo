CREATE TABLE IF NOT EXISTS "fair_scores" (
	"user_id" uuid NOT NULL,
	"week" text NOT NULL,
	"game" text NOT NULL,
	"best" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fair_scores_user_id_week_game_pk" PRIMARY KEY("user_id","week","game"),
	CONSTRAINT "fair_scores_game_ck" CHECK ("fair_scores"."game" in ('2048', 'catch', 'memory'))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "fair_tag" text DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 12) NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fair_scores" ADD CONSTRAINT "fair_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fair_scores_board_idx" ON "fair_scores" USING btree ("week","game","best");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_fair_tag_unique" UNIQUE("fair_tag");--> statement-breakpoint
ALTER TABLE "fair_scores" ENABLE ROW LEVEL SECURITY;