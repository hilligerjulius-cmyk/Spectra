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

# In einem zweiten Terminal: Hintergrund-Worker für Zeitpläne
pnpm worker
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

Erzeugt eine gekennzeichnete Demo-Organisation: E-Mails, Termine, Deals,
Kontakte, Tickets, Beschäftigte, ein offener Urlaubsantrag und Wissensdokumente.
Alle Datensätze tragen die Markierung „Demo“ und lassen sich über
*Integrations → Demo-Daten entfernen* vollständig löschen. Auch über die
Oberfläche erzeugbar.

Die Fälle sind so gewählt, dass die Agenten etwas zu arbeiten haben: ein
überfälliges Ticket, ein gesperrter Kontakt, ein noch nicht entschiedener
Antrag. `tests/integration/demo-seed.test.ts` prüft das — und dass der
Löschvorgang **restlos** ist.

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

## Hintergrund-Worker

```bash
pnpm worker
```

Ein dauerhaft laufender Prozess neben der Anwendung. Er übernimmt:

| Takt | Wie oft | Aufgabe |
| --- | --- | --- |
| `schedule-tick` | jede Minute | fällige Agenten-Zeitpläne einreihen |
| `agent-run` | ereignisgesteuert | Lauf ausführen, bei Fehlern zwei Wiederholungen mit steigendem Abstand |
| `digest-tick` | alle 15 Minuten | Tageszusammenfassungen versenden, deren Uhrzeit erreicht ist |
| `billing-tick` | täglich 03:10 UTC | Rechnungen für abgeschlossene Perioden |
| `approval-expiry` | alle 10 Minuten | überfällige Freigaben auf „abgelaufen" setzen |

**Der Prozess braucht eine Prozessverwaltung** (systemd, Docker-Restart-Policy,
Kubernetes-Deployment), die ihn nach einem Absturz neu startet. Ohne laufenden
Worker bleibt die Anwendung vollständig bedienbar — Läufe lassen sich von Hand
starten, nur Zeitpläne ruhen, bis er wieder läuft.

Mehrere Worker-Prozesse sind erlaubt. Die Taktgeber laufen als `singleton`, und
ein fälliges Zeitfenster wird über ein bedingtes `UPDATE` beansprucht: Auch bei
zwei Prozessen entsteht höchstens ein Lauf je Fenster.

### Zeitpläne

Vier Muster statt Cron: stündlich, täglich, werktäglich (Mo–Fr), wöchentlich —
jeweils mit Uhrzeit und IANA-Zeitzone. Cron wäre mächtiger, ist aber die
häufigste Quelle falsch gesetzter Zeitpläne.

Die Zeitpläne liegen in der Anwendungsdatenbank (`agent_schedule`), nicht in
pg-boss. Dadurch unterliegen sie der Mandantentrennung, stehen im Audit-Log und
sind ohne Worker-Neustart änderbar.

Ein Zeitplan, der **fünfmal in Folge** fehlschlägt, wird automatisch
abgeschaltet und die Organisation benachrichtigt. Ohne diese Grenze würde ein
falsch konfigurierter Agent jede Nacht erneut Kontingent verbrauchen.

Zeitpläne starten keine Läufe für pausierte Agenten oder abgeschaltete
Fähigkeiten — das Zeitfenster bleibt dann unbeansprucht, sodass der Lauf nach
dem Fortsetzen wieder stattfindet.

### pg-boss

pg-boss legt seine Tabellen im **eigenen Schema `pgboss`** an und verbindet sich
mit der Owner-Rolle (`DATABASE_ADMIN_URL`). Beides ist beabsichtigt:
`drizzle-kit` sieht das Schema nicht und erzeugt keine Migration, die es löschen
würde, und die App-Rolle braucht keine Rechte zum Anlegen von Tabellen.

## Bekannte Betriebsgrenzen

| Punkt | Auswirkung |
| --- | --- |
| Verbrauchsperiode ist der Kalendermonat | Zähler setzen sich mit dem Monatswechsel selbst zurück. |
| Abrechnung erst ab dem 2. des Monats | Damit Läufe vom Monatsletzten vollständig erfasst sind. Nur bei aktivem Abo — eine Testphase wird nicht abgerechnet. |
| Zeitpläne mit Minutengenauigkeit | Der Takt läuft jede Minute; sekundengenaue Zeitpläne gibt es nicht. |
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
