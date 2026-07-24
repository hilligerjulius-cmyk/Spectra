-- RLS & Grants: Einrichtungsassistent.
-- Der Zustand gehört genau einer Organisation und wird wie alle Mandantendaten
-- über current_setting('app.org_id') isoliert.

ALTER TABLE "onboarding_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "onboarding_state" TO workforce_app;--> statement-breakpoint
CREATE POLICY "onboarding_state_org_isolation" ON "onboarding_state"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));
