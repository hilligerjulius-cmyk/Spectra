-- RLS & Grants: Fachdatenbestände (Kontakte, Tickets, Personalstammdaten).
--
-- Ohne diese Migration wären die vier Tabellen aus 0018 für die App-Rolle
-- entweder ohne Mandantentrennung zugänglich oder gar nicht — beides fällt
-- erst im Betrieb auf. `drizzle-kit` erzeugt keine Policies; jede neue
-- mandantenbezogene Tabelle braucht diesen Schritt von Hand.
--
-- Muster wie in 0008: eine Policy je Tabelle auf `app.org_id`, gesetzt von
-- withOrg() innerhalb der Transaktion. Ohne Org-Kontext sieht die App-Rolle
-- keine Zeile.

ALTER TABLE "contact" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "contact" TO workforce_app;--> statement-breakpoint
CREATE POLICY "contact_org_isolation" ON "contact"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));--> statement-breakpoint

ALTER TABLE "ticket" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "ticket" TO workforce_app;--> statement-breakpoint
CREATE POLICY "ticket_org_isolation" ON "ticket"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));--> statement-breakpoint

ALTER TABLE "employee" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "employee" TO workforce_app;--> statement-breakpoint
CREATE POLICY "employee_org_isolation" ON "employee"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));--> statement-breakpoint

ALTER TABLE "absence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "absence" TO workforce_app;--> statement-breakpoint
CREATE POLICY "absence_org_isolation" ON "absence"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));
