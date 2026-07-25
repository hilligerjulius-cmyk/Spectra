-- Plattform-Tabellen gehören dem Betreiber, nicht einer Kundenorganisation.
--
-- Anders als bei allen Mandantentabellen wird hier bewusst KEINE RLS-Policy
-- angelegt: Die App-Rolle erhält schlicht keinerlei Rechte. Damit ist ein
-- Zugriff aus dem Anwendungskontext technisch ausgeschlossen — auch dann,
-- wenn eine Berechtigungsprüfung in der Anwendung versehentlich entfiele.
-- Der Adminbereich arbeitet ausschließlich über die Owner-Verbindung.

REVOKE ALL ON "platform_admin" FROM workforce_app;--> statement-breakpoint
REVOKE ALL ON "support_access_log" FROM workforce_app;--> statement-breakpoint
REVOKE ALL ON "feature_flag" FROM workforce_app;
