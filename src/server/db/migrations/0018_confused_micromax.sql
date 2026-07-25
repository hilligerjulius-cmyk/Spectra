CREATE TABLE "absence" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"kind" text DEFAULT 'urlaub' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"working_days" integer NOT NULL,
	"status" text DEFAULT 'beantragt' NOT NULL,
	"note" text,
	"check_result" jsonb,
	"decided_by_user_id" text,
	"decided_at" timestamp with time zone,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"company" text,
	"role" text,
	"kind" text DEFAULT 'lead' NOT NULL,
	"do_not_contact" boolean DEFAULT false NOT NULL,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_contacted_at" timestamp with time zone,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"full_name" text NOT NULL,
	"work_email" text,
	"user_id" text,
	"job_title" text,
	"department" text,
	"manager_employee_id" text,
	"status" text DEFAULT 'aktiv' NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"vacation_days_per_year" integer,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"reference" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"contact_id" text,
	"requester_email" text,
	"status" text DEFAULT 'neu' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"category" text,
	"assigned_team" text,
	"assigned_user_id" text,
	"last_agent_instance_id" text,
	"due_at" timestamp with time zone,
	"first_response_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"satisfaction" integer,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "absence" ADD CONSTRAINT "absence_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absence" ADD CONSTRAINT "absence_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absence" ADD CONSTRAINT "absence_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_last_agent_instance_id_agent_instance_id_fk" FOREIGN KEY ("last_agent_instance_id") REFERENCES "public"."agent_instance"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "absence_org_status_idx" ON "absence" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "absence_employee_idx" ON "absence" USING btree ("employee_id","start_date");--> statement-breakpoint
CREATE INDEX "contact_org_kind_idx" ON "contact" USING btree ("organization_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_org_email_uidx" ON "contact" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX "employee_org_status_idx" ON "employee" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_org_email_uidx" ON "employee" USING btree ("organization_id","work_email");--> statement-breakpoint
CREATE INDEX "ticket_org_status_idx" ON "ticket" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "ticket_org_due_idx" ON "ticket" USING btree ("organization_id","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_org_reference_uidx" ON "ticket" USING btree ("organization_id","reference");