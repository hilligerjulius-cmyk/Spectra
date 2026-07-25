# Architektur

## Überblick

Ein Next.js-16-Monolith (App Router, TypeScript strict) mit PostgreSQL 16.
Die Modularität liegt in der Verzeichnisstruktur unter `src/server/`, nicht in
separaten Diensten — das lässt eine spätere Aufteilung offen, ohne heute
Betriebskomplexität zu erzeugen.

```
src/
├── app/                    Routen (Marketing, Auth, App, Admin, API)
├── components/             Design-System und zusammengesetzte Bausteine
├── lib/env.ts              Zod-validierte Umgebungsvariablen
└── server/
    ├── agents/             Katalog (Daten) + Runtime (Ausführung)
    ├── ai/                 Provider-Abstraktion, Schemas, Embeddings
    ├── auth/               Better Auth, Rollen, Guards
    ├── billing/            Preislogik, Provider, Pläne
    ├── db/                 Drizzle-Schema und Migrationen
    ├── integrations/       Connectoren, Verschlüsselung, Webhook, CSV
    ├── knowledge/          Aufbereitung und hybride Suche
    ├── notifications/      Zustellung und Einstellungen
    ├── onboarding/         Einrichtungsassistent
    ├── platform/           Betreiber-Adminbereich
    └── reports/            Auswertungen aus Laufdaten
```

## Architekturentscheidungen (ADRs)

### ADR-001: Monolith statt Microservices

Ein Deployment, eine Datenbank, eine Transaktionsgrenze. Die Alternative hätte
verteilte Transaktionen zwischen Agentenlauf, Freigabe und Abrechnung
erfordert — Komplexität ohne Gegenwert bei dieser Größe.

### ADR-002: PostgreSQL mit Drizzle statt eines BaaS

Drizzle erzeugt SQL-Migrationen, in denen echte RLS-Policies formuliert werden
können. Das Schema ist typisiert und die Mandantentrennung liegt in der
Datenbank, nicht in einer Bibliothek.

### ADR-003: Mandantentrennung in zwei Ebenen

Zwei Datenbankrollen:

- `workforce_app` — unterliegt RLS. Jede Mandantentabelle hat eine Policy auf
  `current_setting('app.org_id')`. Ohne gesetzten Kontext sieht diese Rolle
  keine Zeile.
- `workforce_owner` — für Migrationen, Auth und Systemjobs.

`withOrg(organizationId, fn)` setzt `app.org_id` per `set_config` innerhalb
einer Transaktion. Zusätzlich prüft die Datenzugriffsschicht den Mandanten —
Defense in Depth. Belegt in `tests/rls/tenant-isolation.test.ts`.

Auth- und Plattformtabellen haben für die App-Rolle **keine** Rechte. Der
Unterschied ist bewusst: Bei Mandantendaten regelt eine Policy den Zugriff,
bei Betreiberdaten gibt es gar keinen.

### ADR-004: Better Auth mit Organization-Plugin

E-Mail/Passwort, Verifikation, Sessions, Organisationen, sechs Rollen, optional
TOTP. Die Berechtigungsmatrix in `src/server/auth/permissions.ts` ist die
einzige Quelle der Wahrheit; `requirePermission()` setzt sie serverseitig durch.

### ADR-005: Provider-Abstraktionen statt harter Abhängigkeiten

Für KI, Embeddings, Abrechnung und E-Mail existiert je ein Interface mit zwei
Implementierungen: dem echten Anbieter (aktiv bei gesetztem Schlüssel) und
einem lokalen Ersatz. Der Ersatz täuscht nichts vor — er ist in der Oberfläche
als solcher gekennzeichnet.

| Bereich | Echt | Ersatz |
| --- | --- | --- |
| KI | `AnthropicProvider` | `ScriptedProvider` (regelbasiert, deterministisch) |
| Embeddings | `VoyageEmbeddingProvider` | `LocalEmbeddingProvider` (Wortform-Ähnlichkeit) |
| Abrechnung | `StripeProvider` | `MockBillingProvider` („Simulierte Abrechnung“) |
| E-Mail | SMTP | Outbox in der Datenbank (kein Versand) |

### ADR-006: Katalog als Code, Konfiguration in der Datenbank

Die 57 Agentendefinitionen sind typisierte Daten unter
`src/server/agents/catalog/`. Sie sind versioniert, testbar und im Review
sichtbar. Was pro Organisation abweicht — Automatisierungsstufen, freigegebene
Werkzeuge, Preis-Overrides — liegt in der Datenbank.

`defineAgent()` deckelt jede Fähigkeit auf die zu ihrem Risiko passende
Höchststufe (`high` → 3). Diese Grenze lässt sich auch bei einer
Katalogerweiterung nicht versehentlich aufheben.

### ADR-007: Freigaben nach dem „Prepared Action“-Muster

Der Agent bereitet die Aktion vollständig strukturiert vor
(`approvalRequest.payload`). Bei Freigabe führt die Runtime **genau diese**
Aktion aus — optional in einer vom Menschen bearbeiteten Fassung. Es läuft kein
zweiter Agentenlauf.

Der Grund: Ein erneuter Lauf könnte zu einem anderen Ergebnis kommen als dem,
das freigegeben wurde. Was ein Mensch gesehen und bestätigt hat, muss
identisch ausgeführt werden.

### ADR-008: Fähigkeits-Archetypen statt Code je Agent

126 Fähigkeiten über 57 Agenten. Jede wird in `runtime/archetypes.ts` einem von
acht Archetypen zugeordnet (monitor, classify, extract, draft, summarize,
report, checklist, qa); je Archetyp existiert ein Handler, der echte Arbeit
verrichtet. Sieben Agenten haben zusätzlich vertiefte, agentenspezifische
Handler mit Vorrang.

Die Zuordnung steht explizit im Code und ist getestet: Kein Eintrag darf auf
eine Rückfallebene fallen. `tests/integration/departments.test.ts` führt jede
Fähigkeit jedes Agenten einmal aus.

### ADR-009: Hybride Suche mit Rechteprüfung im SQL

pgvector-Kosinus (Gewicht 0,6) plus deutsches `ts_rank` (0,4). Die
Rechteprüfung steht in derselben Abfrage, nicht in der Anwendung — ein
Dokument ohne Berechtigung erreicht die Anwendungsschicht nicht.

Der lokale Embedding-Ersatz nutzt Wort-Hashes plus Zeichen-Trigramme.
Trigramme sind nötig, weil reine Wort-Hashes „Kündigungsfrist“ und
„Kündigungsfristen“ orthogonal machen — ein Defekt, der beim manuellen
Nachrechnen der Scores auffiel und jetzt durch Regressionstests abgedeckt ist.

### ADR-010: Grenzen in der Runtime, nicht in der Oberfläche

Je Lauf: 20 Schritte, 120 Sekunden, 2 € KI-Kosten, 15 Werkzeugaufrufe.
Zusätzlich prüft die Runtime vor jedem Lauf das Abrechnungskontingent und
schreibt den Verbrauch danach fort — auch bei Abbruch oder Fehler, weil dabei
ebenfalls Kosten entstanden sein können.

## Datenfluss eines Agentenlaufs

```
startRun()
  ├── Instanz + Katalogdefinition laden
  ├── Sandbox? Status aktiv?
  ├── checkUsageAllowance()          → QuotaExceededError bei erschöpftem Kontingent
  ├── Idempotenzschlüssel prüfen     → vorhandenen Lauf zurückgeben
  └── executeRun()
        ├── effectiveLevel()          Stufe = min(Override ?? Standard, Katalog-Maximum)
        ├── resolveHandler()          agentenspezifisch → Archetyp
        └── Handler
              ├── ctx.ai()            Token und Kosten werden mitgezählt
              ├── ctx.invokeTool()    Prüfung: Instanz-Freigabe UND Fähigkeitsbedarf
              └── ctx.prepareAction()
                    ├── Stufe ≤ 1     nur melden
                    ├── Stufe 2       Entwurf
                    ├── Stufe ≥ 4 und Risiko "low" → direkt ausführen
                    └── sonst         ApprovalRequest + Benachrichtigung
        └── settleUsage() + finalize()
```

## Tests

| Ebene | Ort | Gegenstand |
| --- | --- | --- |
| Unit | `tests/unit/` | Berechtigungen, Katalog, Preise, Archetypen, Verschlüsselung, CSV, Routen |
| RLS | `tests/rls/` | Mandantentrennung gegen die echte Datenbank |
| Integration | `tests/integration/` | Runtime, Szenarien, Wissen, Abrechnung, Benachrichtigungen, Plattform |
| E2E | `tests/e2e/` | Öffentliche Seiten, Kopfzeilen, Zugriffsschutz gegen `next start` |

Die Integrationstests laufen gegen `workforce_test` mit dem deterministischen
KI-Provider — kein API-Schlüssel nötig, Ergebnisse reproduzierbar.
