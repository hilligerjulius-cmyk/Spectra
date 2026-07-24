-- RLS & Grants für Runtime-Tabellen (alle mandantenbezogen)

-- task: volles DML im Org-Scope
ALTER TABLE "task" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "task" TO workforce_app;--> statement-breakpoint
CREATE POLICY "task_org_isolation" ON "task"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));--> statement-breakpoint

-- agent_run: append + update (Statusfortschritt), kein Delete (revisionsfähig)
ALTER TABLE "agent_run" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "agent_run" TO workforce_app;--> statement-breakpoint
CREATE POLICY "agent_run_org_isolation" ON "agent_run"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));--> statement-breakpoint

-- agent_step: append-only (kein Update/Delete)
ALTER TABLE "agent_step" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT ON "agent_step" TO workforce_app;--> statement-breakpoint
CREATE POLICY "agent_step_org_isolation" ON "agent_step"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));--> statement-breakpoint

-- approval_request: append + update (Entscheidung), kein Delete
ALTER TABLE "approval_request" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "approval_request" TO workforce_app;--> statement-breakpoint
CREATE POLICY "approval_request_org_isolation" ON "approval_request"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));--> statement-breakpoint

-- notification: volles DML im Org-Scope
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "notification" TO workforce_app;--> statement-breakpoint
CREATE POLICY "notification_org_isolation" ON "notification"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));
