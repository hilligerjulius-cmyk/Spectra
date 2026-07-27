CREATE TABLE "agent_schedule" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"agent_instance_id" text NOT NULL,
	"capability_key" text NOT NULL,
	"frequency" text NOT NULL,
	"hour" integer DEFAULT 7 NOT NULL,
	"minute" integer DEFAULT 0 NOT NULL,
	"weekday" integer,
	"timezone" text DEFAULT 'Europe/Berlin' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_slot" text,
	"last_run_at" timestamp with time zone,
	"last_run_id" text,
	"last_status" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"disabled_reason" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD CONSTRAINT "agent_schedule_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD CONSTRAINT "agent_schedule_agent_instance_id_agent_instance_id_fk" FOREIGN KEY ("agent_instance_id") REFERENCES "public"."agent_instance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD CONSTRAINT "agent_schedule_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_schedule_instance_capability_uidx" ON "agent_schedule" USING btree ("agent_instance_id","capability_key");--> statement-breakpoint
CREATE INDEX "agent_schedule_enabled_idx" ON "agent_schedule" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "agent_schedule_org_idx" ON "agent_schedule" USING btree ("organization_id");