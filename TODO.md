# Zentrale TODO-Liste

Nur Punkte, die objektiv externe Zugangsdaten, Verträge oder nicht verfügbare
APIs benötigen — oder bewusst zurückgestellte Arbeiten. Format:
**Aufgabe · Grund · Voraussetzung · betroffene Dateien · Priorität**

## Benötigt externe Zugangsdaten

| Aufgabe | Grund | Voraussetzung | Dateien | Prio |
| --- | --- | --- | --- | --- |
| Live-LLM-Aufrufe über Anthropic aktivieren | Kein API-Key in der Umgebung; Runtime nutzt deterministischen ScriptedProvider | `ANTHROPIC_API_KEY` in `.env` | `src/server/ai/*` | Hoch |
| Voyage-Embeddings aktivieren | Anthropic bietet keine Embeddings; lokaler Fallback ist bewusst einfach | `VOYAGE_API_KEY` | `src/server/ai/embeddings/*` | Mittel |
| Stripe-Test-Modus aktivieren | Keine Stripe-Keys vorhanden; Mock-Billing aktiv | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `src/server/billing/*` | Hoch |
| Gmail-/Google-Calendar-OAuth aktivieren | OAuth-Client-Credentials fehlen | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `src/server/integrations/google/*` | Hoch |
| Echten SMTP-Versand aktivieren | Ohne SMTP werden Mails in der Outbox gespeichert | `SMTP_URL` | `src/server/mail/*` | Mittel |

## Bewusst nicht implementiert (Interface vorhanden, klar gekennzeichnet)

| Aufgabe | Grund | Voraussetzung | Dateien | Prio |
| --- | --- | --- | --- | --- |
| Connectoren: HubSpot, Salesforce, Pipedrive, Slack, Teams, Notion, Dropbox, OneDrive, sevdesk, lexoffice, DATEV | Benötigen App-Registrierungen/Verträge und echte Konten zum Testen | Jeweilige Partner-Credentials | `src/server/integrations/connectors/*` | Niedrig |
