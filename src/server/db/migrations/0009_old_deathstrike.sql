CREATE TABLE "invoice_record" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" text DEFAULT 'mock' NOT NULL,
	"external_id" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"monthly_price_cents" integer NOT NULL,
	"yearly_price_per_month_cents" integer NOT NULL,
	"included_agent_seats" integer DEFAULT 0 NOT NULL,
	"included_runs" integer NOT NULL,
	"included_ai_cost_deci_cents" integer NOT NULL,
	"max_team_members" integer,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"setup_fee_cents" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "price_override" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"target_key" text NOT NULL,
	"monthly_price_cents" integer NOT NULL,
	"note" text,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"plan_key" text NOT NULL,
	"status" text DEFAULT 'trialing' NOT NULL,
	"billing_interval" text DEFAULT 'monthly' NOT NULL,
	"provider" text DEFAULT 'mock' NOT NULL,
	"external_customer_id" text,
	"external_subscription_id" text,
	"trial_ends_at" timestamp with time zone,
	"current_period_start" timestamp with time zone DEFAULT now() NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"discount_percent" integer DEFAULT 0 NOT NULL,
	"coupon_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "usage_record" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"period" text NOT NULL,
	"metric" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_record" ADD CONSTRAINT "invoice_record_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_override" ADD CONSTRAINT "price_override_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_record" ADD CONSTRAINT "usage_record_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_org_idx" ON "invoice_record" USING btree ("organization_id","issued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_key_uidx" ON "plan" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "price_override_uidx" ON "price_override" USING btree ("scope","target_key");--> statement-breakpoint
CREATE INDEX "subscription_org_idx" ON "subscription" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_record_uidx" ON "usage_record" USING btree ("organization_id","period","metric");