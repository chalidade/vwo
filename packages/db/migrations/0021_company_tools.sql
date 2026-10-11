CREATE SEQUENCE "public"."fair_invoice_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fair_booth_hooks" (
	"booth_key" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_status" integer,
	"last_at" timestamp with time zone,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fair_booth_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booth_key" text NOT NULL,
	"event_name" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fair_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"user_id" uuid NOT NULL,
	"booth_key" text,
	"payment_id" uuid,
	"buyer" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"subtotal" integer NOT NULL,
	"tax" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"tax_invoice_no" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fair_invoices_method_ck" CHECK ("fair_invoices"."method" in ('gateway','transfer','termin')),
	CONSTRAINT "fair_invoices_status_ck" CHECK ("fair_invoices"."status" in ('issued','paid','void')),
	CONSTRAINT "fair_invoices_total_ck" CHECK ("fair_invoices"."total" >= 0 and "fair_invoices"."subtotal" >= 0 and "fair_invoices"."tax" >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fair_booth_hooks" ADD CONSTRAINT "fair_booth_hooks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fair_booth_reports" ADD CONSTRAINT "fair_booth_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fair_invoices" ADD CONSTRAINT "fair_invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fair_invoices" ADD CONSTRAINT "fair_invoices_payment_id_fair_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."fair_payments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fair_booth_reports_booth_idx" ON "fair_booth_reports" USING btree ("booth_key","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fair_invoices_number_uq" ON "fair_invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fair_invoices_user_idx" ON "fair_invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fair_invoices_booth_idx" ON "fair_invoices" USING btree ("booth_key");--> statement-breakpoint
ALTER TABLE "fair_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fair_booth_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fair_booth_hooks" ENABLE ROW LEVEL SECURITY;
