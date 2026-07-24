-- RLS & Grants: Connector- und Wissens-Tabellen (alle mandantenbezogen)

ALTER TABLE "integration" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "integration" TO workforce_app;--> statement-breakpoint
CREATE POLICY "integration_org_isolation" ON "integration"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));--> statement-breakpoint

ALTER TABLE "email_message" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "email_message" TO workforce_app;--> statement-breakpoint
CREATE POLICY "email_message_org_isolation" ON "email_message"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));--> statement-breakpoint

ALTER TABLE "calendar_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "calendar_event" TO workforce_app;--> statement-breakpoint
CREATE POLICY "calendar_event_org_isolation" ON "calendar_event"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));--> statement-breakpoint

ALTER TABLE "deal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "deal" TO workforce_app;--> statement-breakpoint
CREATE POLICY "deal_org_isolation" ON "deal"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));--> statement-breakpoint

ALTER TABLE "knowledge_document" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "knowledge_document" TO workforce_app;--> statement-breakpoint
CREATE POLICY "knowledge_document_org_isolation" ON "knowledge_document"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));--> statement-breakpoint

ALTER TABLE "knowledge_chunk" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "knowledge_chunk" TO workforce_app;--> statement-breakpoint
CREATE POLICY "knowledge_chunk_org_isolation" ON "knowledge_chunk"
  FOR ALL TO workforce_app
  USING ("organization_id" = current_setting('app.org_id', true))
  WITH CHECK ("organization_id" = current_setting('app.org_id', true));
