-- RLS & Grants: Billing.
-- plan und price_override sind GLOBAL (keine organization_id): die App-Rolle
-- darf sie nur lesen; Änderungen erfolgen über die Owner-Rolle im Plattform-Admin.

GRANT SELECT ON "plan" TO workforce_app;--> statement-breakpoint
GRANT SELECT ON "price_override" TO workforce_app;--> statement-breakpoint

ALTER TABLE "subscription" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "subscription" TO workforce_app;--> statement-breakpoint
CREATE POLICY "subscription_org_isolation" ON "subscription"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));--> statement-breakpoint

ALTER TABLE "usage_record" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "usage_record" TO workforce_app;--> statement-breakpoint
CREATE POLICY "usage_record_org_isolation" ON "usage_record"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));--> statement-breakpoint

-- Rechnungen sind revisionsfähig: kein Delete für die App-Rolle
ALTER TABLE "invoice_record" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT ON "invoice_record" TO workforce_app;--> statement-breakpoint
CREATE POLICY "invoice_record_org_isolation" ON "invoice_record"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));
