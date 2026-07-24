-- RLS & Grants: Benachrichtigungseinstellungen.
-- Eine Zeile je Person und Organisation; Isolation wie bei allen Mandantendaten.

ALTER TABLE "notification_preference" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "notification_preference" TO workforce_app;--> statement-breakpoint
CREATE POLICY "notification_preference_org_isolation" ON "notification_preference"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));
