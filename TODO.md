# Zentrale TODO-Liste

Nur Punkte, die objektiv externe Zugangsdaten, Verträge oder nicht verfügbare
APIs benötigen — oder bewusst zurückgestellte Arbeiten. Format:
**Aufgabe · Grund · Voraussetzung · betroffene Dateien · Priorität**

## Benötigt externe Zugangsdaten

| Aufgabe | Grund | Voraussetzung | Dateien | Prio |
| --- | --- | --- | --- | --- |
| Live-LLM-Aufrufe über Anthropic aktivieren | Kein API-Key in der Umgebung; Runtime nutzt deterministischen ScriptedProvider | `ANTHROPIC_API_KEY` in `.env` | `src/server/ai/anthropic.ts` | Hoch |
| Voyage-Embeddings aktivieren | Anthropic bietet keine Embeddings; lokaler Fallback kennt keine Semantik (nur Wortform-Ähnlichkeit) | `VOYAGE_API_KEY` | `src/server/ai/embeddings.ts` | Mittel |
| Stripe-Test-Modus aktivieren | Keine Stripe-Keys vorhanden; Mock-Billing aktiv | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `src/server/billing/*` | Hoch |
| Gmail-/Google-Calendar-OAuth aktivieren | OAuth-Client-Credentials fehlen; Demo-Connectoren übernehmen bis dahin | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `src/server/integrations/*` | Hoch |
| Echten SMTP-Versand aktivieren | Ohne SMTP werden Mails in der Outbox gespeichert und nicht versendet | `SMTP_URL` | `src/server/mail/index.ts` | Mittel |

## Bewusst nicht implementiert (Interface vorhanden, klar gekennzeichnet)

| Aufgabe | Grund | Voraussetzung | Dateien | Prio |
| --- | --- | --- | --- | --- |
| Connectoren: Outlook, Microsoft Calendar, HubSpot, Salesforce, Pipedrive, Slack, Teams, Notion, Drive, OneDrive, Dropbox, sevdesk, lexoffice, DATEV | Benötigen App-Registrierungen/Verträge und echte Konten zum Testen. Im UI als „Nicht implementiert" gekennzeichnet; die zugehörigen Runtime-Tools werfen einen klaren Fehler statt Ergebnisse vorzutäuschen | Jeweilige Partner-Credentials | `src/server/integrations/registry.ts`, `src/server/agents/runtime/tools.ts` | Niedrig |

## Betriebliche Hinweise

| Aufgabe | Grund | Voraussetzung | Dateien | Prio |
| --- | --- | --- | --- | --- |
| Re-Indexierung bei Wechsel des Embedding-Providers | Embeddings verschiedener Provider sind nicht vergleichbar. Ein Wechsel (z. B. lokal → Voyage) macht bestehende Vektoren unbrauchbar; die Suche liefert dann Zufallstreffer | Re-Ingest aller Dokumente nach Provider-Wechsel | `src/server/knowledge/service.ts` | Hoch |
| pg-boss-Worker für zeitgesteuerte Läufe | Die Runtime führt Läufe derzeit synchron über Server Actions aus. Für Zeitpläne und Retries im Hintergrund fehlt der Worker-Prozess | Deployment-Umgebung mit dauerhaftem Prozess | `src/server/jobs/*` | Mittel |
