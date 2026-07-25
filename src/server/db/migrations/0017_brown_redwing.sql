-- Herkunft von Wissensinhalten.
-- Hintergrund: Mit `knowledge.write` und `documents.write` können Agenten selbst
-- in die Wissensbasis schreiben. Ohne Herkunftsangabe wäre ein von einem Agenten
-- erzeugter Text in der Suche nicht von einem hochgeladenen Vertrag zu
-- unterscheiden — ein anderer Agent würde ihn als Beleg zitieren. Die Spalten
-- machen die Erzeugung nachvollziehbar und in der Oberfläche kennzeichenbar.
-- Keine neue RLS-Policy nötig: die Tabelle ist über 0008 bereits abgedeckt.

ALTER TABLE "knowledge_document" ADD COLUMN "origin" text DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_document" ADD COLUMN "created_by_agent_instance_id" text;--> statement-breakpoint
ALTER TABLE "knowledge_document" ADD COLUMN "created_by_run_id" text;