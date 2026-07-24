-- RLS & Grants: agent_instance (mandantenbezogen, App-Rolle mit vollem DML im Org-Scope)
ALTER TABLE "agent_instance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "agent_instance" TO workforce_app;--> statement-breakpoint
CREATE POLICY "agent_instance_org_isolation" ON "agent_instance"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));
