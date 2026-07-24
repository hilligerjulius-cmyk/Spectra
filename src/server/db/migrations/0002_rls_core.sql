-- =============================================================================
-- Row Level Security & Grants für Mandantentrennung
--
-- Konvention:
--  * Auth-Tabellen (user, session, account, verification, organization,
--    member, invitation, two_factor) sind AUSSCHLIESSLICH über die
--    Owner-Rolle (adminDb) erreichbar — die App-Rolle erhält KEINE Grants.
--  * Jede mandantenbezogene Tabelle:
--      - ENABLE ROW LEVEL SECURITY
--      - Policy org_isolation: organization_id = current_setting('app.org_id')
--      - explizite, minimale Grants für workforce_app
--  * Ohne gesetztes app.org_id (kein withOrg-Kontext) sieht die App-Rolle
--    keine Zeilen.
-- =============================================================================

-- audit_log: App darf lesen und einfügen, niemals ändern oder löschen (append-only)
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT ON "audit_log" TO workforce_app;--> statement-breakpoint
CREATE POLICY "audit_log_org_isolation" ON "audit_log"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));--> statement-breakpoint

-- mail_outbox: App darf nur lesen (Schreiben erfolgt über Owner-Rolle im Mail-Layer)
ALTER TABLE "mail_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT ON "mail_outbox" TO workforce_app;--> statement-breakpoint
CREATE POLICY "mail_outbox_org_isolation" ON "mail_outbox"
  FOR SELECT TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true));
