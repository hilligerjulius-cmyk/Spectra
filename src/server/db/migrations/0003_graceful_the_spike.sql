CREATE TABLE "agent_instance" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"definition_slug" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'sandbox' NOT NULL,
	"automation_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"disabled_capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_data_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"responsible_user_id" text,
	"monthly_cost_limit_cents" integer,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sandbox_passed_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_instance" ADD CONSTRAINT "agent_instance_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_instance" ADD CONSTRAINT "agent_instance_responsible_user_id_user_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_instance_org_slug_uidx" ON "agent_instance" USING btree ("organization_id","definition_slug");--> statement-breakpoint
CREATE INDEX "agent_instance_org_status_idx" ON "agent_instance" USING btree ("organization_id","status");