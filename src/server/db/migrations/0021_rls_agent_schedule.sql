-- RLS & Grants: Zeitpläne für Agentenläufe.
--
-- Der Worker liest Zeitpläne organisationsübergreifend und arbeitet dafür mit
-- der Owner-Rolle (adminDb) — er hat keinen Org-Kontext, bevor er weiß, welche
-- Organisation fällig ist. Sobald er einen Zeitplan hat, läuft alles Weitere
-- über withOrg(). Die Policy hier schützt den Zugriff aus der Anwendung: Eine
-- Organisation darf ausschließlich ihre eigenen Zeitpläne sehen und ändern.

ALTER TABLE "agent_schedule" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "agent_schedule" TO workforce_app;--> statement-breakpoint
CREATE POLICY "agent_schedule_org_isolation" ON "agent_schedule"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));
