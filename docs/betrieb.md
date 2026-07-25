# Betrieb und Einrichtung

## Voraussetzungen

- Node 22 und pnpm 10
- PostgreSQL 16 mit den Erweiterungen `pgvector` und `pgcrypto`

## Erstinstallation

```bash
pnpm install

# Datenbank vorbereiten (einmalig, als Superuser)
psql -c "CREATE ROLE workforce_owner LOGIN PASSWORD '…';"
psql -c "CREATE ROLE workforce_app   LOGIN PASSWORD '…';"
psql -c "CREATE DATABASE workforce_dev  OWNER workforce_owner;"
psql -c "CREATE DATABASE workforce_test OWNER workforce_owner;"
psql -d workforce_dev  -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql -d workforce_test -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pgcrypto;"

cp .env.example .env      # Werte anpassen
pnpm db:migrate
pnpm db:migrate:test
pnpm dev
```

**Wichtig:** `DATABASE_URL` muss auf `workforce_app` zeigen. Zeigt sie auf die
Owner-Rolle, ist die Mandantentrennung wirkungslos — RLS gilt nicht für den
Tabelleneigentümer.

## Umgebungsvariablen

Ohne die optionalen Schlüssel ist die Anwendung vollständig bedienbar und
testbar; der jeweilige Ersatz ist in der Oberfläche unter *Settings →
Systemzustand* gekennzeichnet.

| Variable | Pflicht | Wirkung |
| --- | --- | --- |
| `DATABASE_URL` | ja | Anwendungsrolle (RLS-unterworfen) |
| `DATABASE_ADMIN_URL` | ja | Owner-Rolle für Migrationen und Systemjobs |
| `AUTH_SECRET` | in Produktion | Sitzungssignatur; der Entwicklungswert wird dort abgelehnt |
| `CREDENTIAL_ENCRYPTION_KEY` | ja | 64 Hex-Zeichen für AES-256-GCM |
| `APP_URL` | ja | Basis für Links in E-Mails und Webhook-Endpunkt |
| `ANTHROPIC_API_KEY` | nein | ohne: deterministischer, regelbasierter Provider |
| `VOYAGE_API_KEY` | nein | ohne: lokale Embeddings (Wortform-Ähnlichkeit) |
| `STRIPE_SECRET_KEY` | nein | ohne: simulierte Abrechnung |
| `SMTP_URL` | nein | ohne: E-Mails landen im einsehbaren Postausgang |
| `GOOGLE_CLIENT_ID` / `_SECRET` | nein | ohne: Gmail und Google Calendar bleiben gesperrt |

## Plattform-Zugang vergeben

Der Adminbereich unter `/admin` ist zunächst für niemanden erreichbar. Es gibt
bewusst keinen Weg, sich diese Rechte aus der Anwendung heraus selbst zu geben.

```bash
pnpm platform:admin -- person@example.com admin      # Vollzugriff
pnpm platform:admin -- person@example.com support    # nur Einsicht, protokollpflichtig
pnpm platform:admin -- person@example.com entziehen
pnpm platform:admin -- --liste
```

Die Person muss vorher ein Konto in der Anwendung haben.

## Demo-Daten

```bash
pnpm db:seed:demo
```

Erzeugt eine gekennzeichnete Demo-Organisation. Alle Datensätze tragen die
Markierung „Demo“ und lassen sich über *Integrations → Demo-Daten entfernen*
vollständig löschen. Auch über die Oberfläche erzeugbar.

## Prüfen

```bash
pnpm lint
pnpm typecheck
pnpm test          # Unit, RLS, Integration gegen workforce_test
pnpm build
pnpm e2e           # Playwright gegen next start (build vorher nötig)
```

Die E2E-Tests starten die Anwendung über `scripts/e2e-server.ts` auf Port 3100
gegen `workforce_test`. Sie verändern nie die Entwicklungsdatenbank.

Ist Chromium an einem anderen Ort installiert:
`PLAYWRIGHT_CHROMIUM_PATH=/pfad/zu/chrome pnpm e2e`

## Migrationen

```bash
pnpm db:generate                 # Schemaänderung → SQL erzeugen
# RLS-Policy für neue Mandantentabellen HANDSCHRIFTLICH ergänzen
pnpm db:migrate && pnpm db:migrate:test
```

`drizzle-kit` erzeugt **keine** RLS-Policies. Für jede neue mandantenbezogene
Tabelle gehört eine eigene Migration nach dem Muster von
`0012_rls_onboarding.sql` dazu — sonst ist die Tabelle ohne Trennung
zugänglich. Die RLS-Tests fangen das ab, wenn eine Prüfung ergänzt wird.

## Wechsel des Embedding-Providers

Embeddings verschiedener Anbieter sind nicht vergleichbar. Nach einem Wechsel
(lokal → Voyage oder umgekehrt) liefert die Vektorsuche Zufallstreffer, bis
alle Dokumente neu eingelesen wurden. Vorgehen: Dokumente entfernen und erneut
hochladen.

## Bekannte Betriebsgrenzen

| Punkt | Auswirkung |
| --- | --- |
| Kein Hintergrundprozess | Läufe starten synchron über Server Actions. Zeitpläne und Retries brauchen den geplanten pg-boss-Worker. |
| Rechnungen nur manuell | `issueInvoice()` läuft auf Anforderung. Für automatische Abrechnung fehlt derselbe Worker. |
| Verbrauchsperiode ist der Kalendermonat | Zähler setzen sich mit dem Monatswechsel selbst zurück. |
| Kein Rate Limiting am Rand | Gehört auf den Reverse Proxy, nicht in die Anwendung. |

Vollständig geführt in `TODO.md`.

## Fehlersuche

| Symptom | Ursache |
| --- | --- |
| „AUTH_SECRET muss in Produktion gesetzt werden.“ | Entwicklungswert bei `NODE_ENV=production`. Eigenes Secret setzen. |
| Alle Abfragen liefern leere Ergebnisse | Zugriff ohne `withOrg()`. Ohne Org-Kontext sieht die App-Rolle nichts — RLS arbeitet korrekt. |
| „permission denied for table …“ | Zugriff der App-Rolle auf Auth- oder Plattformtabellen. Gewollt: `adminDb` verwenden. |
| Wissenssuche findet nichts Passendes | Nach Provider-Wechsel neu indexieren (siehe oben). |
| „Tool … ist noch nicht verfügbar“ | Connector nicht implementiert oder nicht verbunden. Kein Fehler, sondern die ehrliche Meldung. |
| Playwright startet keinen Browser | Revision passt nicht. `PLAYWRIGHT_CHROMIUM_PATH` setzen. |
