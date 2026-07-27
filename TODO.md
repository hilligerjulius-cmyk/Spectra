# Zentrale TODO-Liste

Nur Punkte, die objektiv externe Zugangsdaten, Verträge oder nicht verfügbare
APIs benötigen — oder bewusst zurückgestellte Arbeiten. Format:
**Aufgabe · Grund · Voraussetzung · betroffene Dateien · Priorität**

## Benötigt externe Zugangsdaten

| Aufgabe | Grund | Voraussetzung | Dateien | Prio |
| --- | --- | --- | --- | --- |
| Live-LLM-Aufrufe über Anthropic aktivieren | Kein API-Key in der Umgebung; Runtime nutzt deterministischen ScriptedProvider | `ANTHROPIC_API_KEY` in `.env` | `src/server/ai/anthropic.ts` | Hoch |
| Voyage-Embeddings aktivieren | Anthropic bietet keine Embeddings; lokaler Fallback kennt keine Semantik (nur Wortform-Ähnlichkeit) | `VOYAGE_API_KEY` | `src/server/ai/embeddings.ts` | Mittel |
| Stripe-Test-Modus aktivieren | Keine Stripe-Keys vorhanden; ohne Schlüssel läuft die simulierte Abrechnung (`MockBillingProvider`). Der Stripe-Adapter ist implementiert, aber **nicht gegen die echte API getestet** — er wird ohne Schlüssel nicht instanziiert | `STRIPE_SECRET_KEY` | `src/server/billing/providers/stripe.ts` | Hoch |
| Stripe-Webhook-Route für Abo-Statuswechsel | Bei echten Zahlungen bestätigt erst der Webhook (`checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`) den Abo-Status; bis dahin bleibt der bisherige Status stehen | `STRIPE_WEBHOOK_SECRET` + öffentlich erreichbare URL | `src/app/api/` (Route fehlt noch), `src/server/billing/service.ts` | Hoch |
| Gmail-/Google-Calendar-OAuth aktivieren | OAuth-Client-Credentials fehlen; Demo-Connectoren übernehmen bis dahin | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `src/server/integrations/*` | Hoch |
| Echten SMTP-Versand aktivieren | Ohne SMTP werden Mails in der Outbox gespeichert und nicht versendet | `SMTP_URL` | `src/server/mail/index.ts` | Mittel |

## Offene Eigenleistung (braucht KEINE externen Zugangsdaten)

Dieser Abschnitt steht bewusst getrennt: Diese Punkte sind nicht durch
Zugangsdaten blockiert, sondern noch nicht gebaut. Sie als „braucht
Credentials" zu führen wäre eine Beschönigung.

| Aufgabe | Grund | Voraussetzung | Dateien | Prio |
| --- | --- | --- | --- | --- |
| Verwaltungsansichten für Tickets, Kontakte und Personal | Tabellen (`ticket`, `contact`, `employee`, `absence`) und die neun Fachwerkzeuge sind fertig, aber es gibt keine Oberfläche zum Pflegen einzelner Datensätze. Daten kommen heute über CSV-Import, Webhook oder Demo-Seed hinein und über CSV-Export hinaus | — | neu unter `src/app/app/` | Mittel |
| `web.research` | Braucht eine externe Suchschnittstelle und ausgehenden Netzzugriff — das einzige der 33 Katalog-Werkzeuge, das ohne Drittanbieter grundsätzlich nicht umsetzbar ist. Betrifft `lead-research`, `travel-planning`, `research` | Such-API-Zugang | `src/server/agents/runtime/tools-connectors.ts` | Mittel |

## Bewusst nicht implementiert (Interface vorhanden, klar gekennzeichnet)

| Aufgabe | Grund | Voraussetzung | Dateien | Prio |
| --- | --- | --- | --- | --- |
| Connectoren: Outlook, Microsoft Calendar, HubSpot, Salesforce, Pipedrive, Slack, Teams, Notion, Drive, OneDrive, Dropbox, sevdesk, lexoffice, DATEV | Benötigen App-Registrierungen/Verträge und echte Konten zum Testen. Im UI als „Nicht implementiert" gekennzeichnet; die zugehörigen Runtime-Tools werfen einen klaren Fehler statt Ergebnisse vorzutäuschen | Jeweilige Partner-Credentials | `src/server/integrations/registry.ts`, `src/server/agents/runtime/tools.ts` | Niedrig |

## Betriebliche Hinweise

| Aufgabe | Grund | Voraussetzung | Dateien | Prio |
| --- | --- | --- | --- | --- |
| Plattform-Zugang wird über ein CLI vergeben | Es gibt bewusst keinen Weg, sich Plattformrechte aus der Anwendung heraus selbst zu geben. Der erste Zugang muss auf dem Server gesetzt werden: `pnpm platform:admin -- <e-mail> admin` | Datenbankzugriff mit der Owner-Rolle | `scripts/grant-platform-admin.ts` | Hoch |
| Re-Indexierung bei Wechsel des Embedding-Providers | Embeddings verschiedener Provider sind nicht vergleichbar. Ein Wechsel (z. B. lokal → Voyage) macht bestehende Vektoren unbrauchbar; die Suche liefert dann Zufallstreffer | Re-Ingest aller Dokumente nach Provider-Wechsel | `src/server/knowledge/service.ts` | Hoch |
| Worker-Prozess unter Prozessverwaltung stellen | Der Worker (`pnpm worker`) ist implementiert und getestet, aber ein einzelner Prozess. Für den Produktivbetrieb braucht er eine Instanz, die ihn nach Absturz neu startet (systemd, Docker-Restart-Policy, Kubernetes). Ohne laufenden Worker ruhen Zeitpläne — die Anwendung bleibt bedienbar | Deployment-Umgebung mit dauerhaftem Prozess | `scripts/worker.ts`, Deployment-Konfiguration | Hoch |
| Oberfläche für Zeitpläne | Server Actions (`src/server/jobs/actions.ts`) und Datenmodell sind fertig und geprüft; eine Ansicht zum Anlegen und Bearbeiten auf der Agenten-Detailseite fehlt noch. Bis dahin sind Zeitpläne nur über die Actions bzw. direkt in der Datenbank setzbar | — | neu unter `src/app/app/agents/` | Mittel |
