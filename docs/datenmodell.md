# Datenmodell

37 Tabellen, definiert als Drizzle-Schema unter `src/server/db/schema/`, ausgeliefert
über 20 SQL-Migrationen unter `src/server/db/migrations/`.

## Drei Zonen mit unterschiedlichem Zugriffsmodell

Die Trennung ist die wichtigste Eigenschaft des Modells:

| Zone | Tabellen | App-Rolle (`workforce_app`) |
| --- | --- | --- |
| **Mandantendaten** | 23 Tabellen mit `organization_id` | RLS-Policy auf `current_setting('app.org_id')` |
| **Auth** | `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, `two_factor` | keine Rechte — nur `adminDb` |
| **Plattform** | `platform_admin`, `support_access_log`, `feature_flag` | keine Rechte (Migration `0016`) |

Bei Mandantendaten regelt eine Policy den Zugriff. Bei Auth- und Plattformdaten
gibt es keinen Zugriff — ein Unterschied, der beabsichtigt ist: eine fehlerhafte
Policy wäre eine Lücke, ein fehlendes `GRANT` ist keine.

Die 23 Tabellen mit RLS: `absence`, `agent_instance`, `agent_run`, `agent_step`,
`approval_request`, `audit_log`, `calendar_event`, `contact`, `deal`,
`email_message`, `employee`, `integration`, `invoice_record`, `knowledge_chunk`,
`knowledge_document`, `mail_outbox`, `notification`, `notification_preference`,
`onboarding_state`, `subscription`, `task`, `ticket`, `usage_record`.

Die restlichen drei Tabellen sind global: `plan` und `price_override`
(Preiskatalog, vom Plattform-Admin gepflegt — `price_override` trägt optional
eine `organization_id` für kundenspezifische Preise) sowie `system_meta`
(Schemaversion und Betriebsmarker).

## Kernkette eines Agentenlaufs

```
agent_instance   (Konfiguration je Organisation)
      │
      └─▶ agent_run          (ein Lauf: Ziel, Status, Kosten, Tokens, Limits)
              │
              ├─▶ agent_step        (Timeline: Phase, Titel, Detail, Kosten)
              │
              └─▶ approval_request  (vorbereitete Aktion, wartet auf Entscheidung)
                        │
                        └─▶ audit_log  (Entscheidung und Ausführung)
```

### `agent_instance` — Konfiguration, nicht Definition

Die Definition eines Agenten (Fähigkeiten, Systemprompt, Grenzen, KPIs) liegt
**im Code** unter `src/server/agents/catalog/` — versioniert, typisiert, im
Review sichtbar. In der Datenbank steht nur, was pro Organisation abweicht:

| Spalte | Bedeutung |
| --- | --- |
| `definition_slug` | Verweis in den Katalog; `UNIQUE (organization_id, definition_slug)` — ein Agent pro Organisation |
| `status` | `sandbox` → `active` → `paused` / `disabled` |
| `automation_overrides` | `capabilityKey → Stufe`. Wird zur Laufzeit auf das Katalogmaximum gedeckelt, nie umgekehrt |
| `disabled_capabilities` | einzelne Fähigkeiten abschaltbar, ohne den Agenten zu deaktivieren |
| `allowed_tools` | die zweite Hälfte der Werkzeugprüfung (die erste ist `capability.requiredTools`) |
| `allowed_data_sources` | freigegebene Connectoren/Quellen |
| `monthly_cost_limit_cents` | Kostendeckel je Agent, `null` = Organisationsvorgabe |
| `sandbox_passed_at` | ein Agent wird erst nach einem erfolgreichen Testlauf aktivierbar |

### `agent_run` — Nachweis, nicht Protokoll-Nebenprodukt

Jeder Lauf hält fest, wodurch er ausgelöst wurde (`trigger`: `manual`,
`schedule`, `event`, `delegation`, `sandbox_test`), was hinein- und
herausging (`input`/`output` als JSONB), welches Modell antwortete, wie viele
Tokens flossen und was es kostete (`cost_deci_cents` — Zehntel-Cent, weil Cent
zu grob und Millicent Scheingenauigkeit wäre).

`UNIQUE (organization_id, idempotency_key)` verhindert, dass derselbe Auslöser
zweimal läuft. `sandbox = true` schließt einen Lauf aus Abrechnung und
Auswertungen aus — Testläufe verfälschen keine Zahlen.

### `agent_step` — die Timeline

Ein Schritt je Phase (`plan`, `retrieve`, `reason`, `draft`, `validate`,
`request_approval`, `execute`, `verify`, `report`) mit `index` für die
Reihenfolge. In `detail` stehen Werkzeugname, Eingabe- und Ausgabekurzfassung
und Quellenangaben — **bewusst keine internen Gedankengänge des Modells**:
sie sind für Nachvollziehbarkeit nicht nötig und können fremde Inhalte
unreflektiert wiedergeben.

### `approval_request` — das „Prepared Action"-Muster

`payload` enthält die vollständige, strukturierte Aktion. Bei Freigabe führt
die Runtime genau diese aus — oder `edited_payload`, wenn ein Mensch sie
bearbeitet hat. Es läuft kein zweiter Agentenlauf (ADR-007).

`action_type` (z. B. `task.create`, `email.send`) macht Sammelfreigaben
möglich; sie sind auf `risk_level = "low"` beschränkt. `expires_at` lässt eine
vorbereitete Aktion verfallen, statt sie unbegrenzt freigebbar zu halten.

## Wissenssystem

```
knowledge_document ──▶ knowledge_chunk
   accessScope          embedding vector(1024)
   allowedRoles[]       tsvector (deutsch, per Migration)
```

`access_scope` ist `organization` (alle Rollen mit `knowledge.view`) oder
`restricted` (nur Rollen in `allowed_roles`). Die Prüfung steht **in der
Suchabfrage selbst**, nicht in der Anwendung — ein unzulässiges Chunk erreicht
die Anwendungsschicht nicht (ADR-009).

`embedding_provider` wird je Dokument festgehalten. Das ist nötig, weil
Embeddings verschiedener Anbieter nicht vergleichbar sind: nach einem Wechsel
lässt sich erkennen, welche Dokumente neu eingelesen werden müssen.

### Herkunft (`origin`, `created_by_agent_instance_id`, `created_by_run_id`)

Agenten können über `knowledge.write` und `documents.write` selbst schreiben.
Ohne Herkunftsangabe wäre ein so entstandener Text in der Suche nicht von einem
hochgeladenen Vertrag zu unterscheiden — ein anderer Agent würde ihn als Beleg
zitieren und die Falschinformation würde sich fortpflanzen.

| Wert | Bedeutung |
| --- | --- |
| `upload` | von einem Menschen hochgeladen; `uploaded_by_user_id` gesetzt |
| `agent_knowledge` | von einem Agenten in die Wissensbasis geschrieben |
| `agent_document` | von einem Agenten erzeugtes Dokument (immer Entwurf) |

`searchKnowledge()` gibt `origin` mit jedem Treffer zurück. Zusätzlich steht ein
Herkunftsvermerk **im Text selbst** — die Spalte allein bliebe zurück, sobald
ein Abschnitt zitiert oder exportiert wird.

1024 Dimensionen passen zu Voyage `voyage-3` und werden vom lokalen
Ersatzverfahren ebenfalls erzeugt — der Providerwechsel braucht keine Migration.

## Fachdatenbestände

Vier Tabellen in `schema/business.ts`, damit die Agenten einen echten
Datenbestand haben, solange kein Fremdsystem angebunden ist. Sie sind
absichtlich schlank und ersetzen kein gewachsenes CRM, Helpdesk oder HR-System.
Vorbild ist die ältere `deal`-Tabelle (CRM-light).

| Tabelle | Inhalt | Besonderheit |
| --- | --- | --- |
| `contact` | Personen und Firmen | `do_not_contact` als Sperrvermerk; `UNIQUE (organization_id, email)` verhindert Dubletten beim Import |
| `ticket` | Serviceanfragen | `UNIQUE (organization_id, reference)` sichert die fortlaufende Nummer `T-<jahr>-<lfd>` auch bei parallelen Zugriffen; `first_response_at` und `resolved_at` sind Messgrößen und werden nie überschrieben |
| `employee` | Beschäftigte | siehe unten |
| `absence` | Abwesenheitsanträge | `status` bleibt `beantragt`, bis ein **Mensch** entscheidet; `check_result` hält die formale Prüfung eines Agenten getrennt davon |

### Was in `employee` bewusst fehlt

Kein Gehalt, keine Bankverbindung, kein Geburtsdatum, keine Gesundheitsdaten,
keine Beurteilungen. Keine der abgebildeten Fähigkeiten braucht sie — und was
nicht gespeichert ist, kann nicht abfließen und nicht versehentlich in einen
Agentenlauf geraten. Wer Abrechnung braucht, bindet ein Fachsystem an.

Aus demselben Grund gibt `hr.read` das Feld `absence.note` **nicht** heraus: Ein
Krankheitsgrund hätte in einem Lauf, einem Entwurf oder einem Protokoll nichts
zu suchen. Die formalen Angaben (Art, Zeitraum, Arbeitstage, Status) reisen mit.

## Abrechnung

| Tabelle | Inhalt |
| --- | --- |
| `plan` | Starter/Growth/Scale/Enterprise: Preise, enthaltene Plätze, Laufkontingent, KI-Kostenkontingent |
| `price_override` | Preisabweichung je `agent` \| `department` \| `tier`, optional je Organisation |
| `subscription` | Plan, Status (`trialing`/`active`/`past_due`/`canceled`), Zyklus, führender Provider (`stripe` \| `mock`), Gutschein |
| `usage_record` | Verbrauch je Periode (`YYYY-MM`) und Metrik (`agent_run`, `ai_cost`) |
| `invoice_record` | erzeugte Rechnungen mit Positionen |

Preise stehen **nie im Client**. Die Oberfläche sendet Auswahlschlüssel; alle
Beträge berechnet `src/server/billing/service.ts`. Ein manipulierter Request
kann keinen Preis setzen.

Die Verbrauchsperiode ist der Kalendermonat und setzt sich damit selbst
zurück — kein Job nötig. Preisänderungen wirken deshalb ab dem Folgemonat.

## Nachvollziehbarkeit

`audit_log` ist append-only: die App-Rolle hat `INSERT` und `SELECT`, aber
**kein** `UPDATE` oder `DELETE`. Jeder Eintrag nennt Akteur (`user` \| `agent`
\| `system`), Aktion, Ziel und eine lesbare Zusammenfassung.

Auch eine Support-Einsicht des Betreibers erzeugt einen Eintrag — im Log **der
betroffenen Organisation**, sodass die Kundin den Zugriff selbst sieht.

## Konventionen

- **IDs**: `text` mit `crypto.randomUUID()` als Default. Kein `serial` —
  fortlaufende Zahlen verraten Mengen und laden zum Durchprobieren ein.
- **Zeitstempel**: immer `timestamptz`.
- **Aufzählungen**: `text` mit dokumentierten Werten statt Postgres-Enums.
  Grund: ein neuer Wert braucht keine Migration mit Tabellensperre; die
  Typsicherheit kommt aus TypeScript.
- **`ON DELETE`**: `cascade` bei echter Zugehörigkeit (Lauf → Schritt),
  `set null` bei Referenzen (Aufgabe → zuständige Person).
- **JSONB** für strukturell veränderliche Nutzlasten (`payload`, `trigger`,
  `detail`, `settings`) — mit TypeScript-Typ über `$type<…>()`.
- **`demo`-Spalte** auf Seed-Daten: markiert Demo-Datensätze und macht sie
  restlos löschbar.

## Eine Tabelle hinzufügen

```bash
# 1. Schema unter src/server/db/schema/ ergänzen (organization_id NOT NULL!)
pnpm db:generate
# 2. RLS-Policy HANDSCHRIFTLICH als eigene Migration nach Muster 0012_rls_onboarding.sql
# 3. Prüfung in tests/rls/tenant-isolation.test.ts ergänzen
pnpm db:migrate && pnpm db:migrate:test && pnpm vitest run tests/rls
```

`drizzle-kit` erzeugt **keine** RLS-Policies. Ohne Schritt 2 ist die Tabelle
für die App-Rolle entweder ohne Trennung zugänglich oder gar nicht — beides
fällt erst im Betrieb auf, wenn Schritt 3 fehlt.
