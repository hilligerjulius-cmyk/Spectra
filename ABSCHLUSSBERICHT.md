# Abschlussbericht — WORKFORCE OS

Stand: 25. Juli 2026 · Branch `claude/workforce-os-saas-platform-ynbpza`

Dieser Bericht nennt den geprüften Stand. Wo etwas fehlt, unvollständig oder
ungetestet ist, steht das hier — nicht in einer Fußnote.

---

## 1. Kennzahlen

| | |
| --- | --- |
| Quelldateien (`src/`) | 222 (TypeScript/TSX), ca. 37.600 Zeilen |
| Datenbanktabellen | 38, davon 24 mandantenbezogen mit RLS-Policy |
| SQL-Migrationen | 22 |
| Agenten im Katalog | 57 über 8 Departments (7 Fachbereiche + Chief of Staff) |
| Fähigkeiten | 126 (Risiko: 88 niedrig, 27 mittel, 11 hoch) |
| Runtime-Werkzeuge | 33 vom Katalog referenziert, **32 echt implementiert**, 1 Platzhalter (`web.research`) |
| Agenten mit vollem Datenzugang | **54 von 57** (3 teilweise, 0 ohne eigenen Zugang) |
| Seiten | 19 Marketing, 18 App, 5 Admin, 3 API-Routen |
| UI-Komponenten | 42 |
| Tests | **220 Vitest** (25 Dateien) + **31 Playwright** = 251 |

---

## 2. Testergebnisse (selbst ausgeführt, letzter Durchlauf)

```
pnpm lint       → keine Meldungen
pnpm typecheck  → keine Fehler
pnpm test       → Test Files 25 passed (25) | Tests 220 passed (220)  [10,52 s]
pnpm build      → erfolgreich, 54 Routen
pnpm e2e        → 31 passed (12,9 s)
```

Die Vitest-Suite läuft gegen eine echte PostgreSQL-16-Datenbank
(`workforce_test`) mit dem deterministischen KI-Provider. Playwright läuft gegen
`next start` — nicht gegen den Dev-Server.

### Verteilung

| Datei | Tests | Gegenstand |
| --- | --- | --- |
| `tests/integration/jobs.test.ts` | 17 | Hintergrund-Worker: Fenster-Beanspruchung ohne Doppellauf, pausierte Agenten, automatische Abschaltung nach Fehlläufen, doppelte Rechnungen, Freigabe-Verfall |
| `tests/unit/schedule.test.ts` | 20 | Fälligkeitsberechnung inklusive beider Sommerzeitwechsel und fremder Zeitzonen |
| `tests/rls/tenant-isolation.test.ts` | 9 | Mandantentrennung gegen die echte DB, inklusive der vier Fachtabellen |
| `tests/integration/tools-business.test.ts` | 22 | Schutzregeln der Fachwerkzeuge: keine erfundenen Personen, Sperrvermerke unumkehrbar, keine genehmigten Personalvorgänge, keine Gesundheitsdaten im Lauf, CSV-Import mit Dublettenmeldung |
| `tests/integration/tools-platform.test.ts` | 20 | Selbstbegrenzungen der Plattform-Werkzeuge: keine Delegationsrekursion, keine Selbstbeauftragung, kein Anhalten im Sandbox-Lauf, keine geschätzten Beträge, Herkunft agentengeschriebener Inhalte |
| `tests/integration/demo-seed.test.ts` | 2 | Demo-Daten erzeugen und **restlos** entfernen; enthält die Fälle, an denen die Agenten arbeiten können |
| `tests/integration/scenarios.test.ts` | 5 | **die 5 Pflichtszenarien aus §27** |
| `tests/integration/webhook.test.ts` | 11 | Signatur, Replay-Fenster, Nutzlastgrenzen |
| `tests/integration/notifications.test.ts` | 10 | Typen, Präferenzen, Digest, Zeitvalidierung |
| `tests/integration/runtime.test.ts` | 8 | Lebenszyklus, Limits, Idempotenz, Abbruch |
| `tests/integration/platform.test.ts` | 8 | Betreiberzugang, protokollierte Support-Einsicht |
| `tests/integration/security.test.ts` | 7 | Prompt Injection, Berechtigungen, Halluzination |
| `tests/integration/billing.test.ts` | 7 | Preisberechnung, Kontingente, Planwechsel |
| `tests/integration/knowledge.test.ts` | 6 | Aufbereitung, hybride Suche, Rechteprüfung |
| `tests/integration/onboarding.test.ts` | 6 | 14 Schritte, Sandbox-Pflicht vor Aktivierung |
| `tests/integration/auth.test.ts` | 4 | Registrierung, Sessions, Organisationen |
| `tests/integration/departments.test.ts` | 3 | **führt jede der 126 Fähigkeiten real aus** |
| `tests/integration/db.test.ts` | 2 | Verbindung, Rollen, Erweiterungen |
| `tests/unit/crypto-csv.test.ts` | 15 | AES-256-GCM, HMAC, RFC-4180-Parser |
| `tests/unit/catalog.test.ts` | 7 | Katalogintegrität, Risiko-Obergrenzen |
| `tests/unit/configurator.test.ts` | 7 | Empfehlungslogik |
| `tests/unit/permissions.test.ts` | 7 | Berechtigungsmatrix aller 6 Rollen |
| `tests/unit/pricing.test.ts` | 7 | Preislogik, Overrides |
| `tests/unit/archetypes.test.ts` | 5 | jede Fähigkeit hat einen Archetyp |
| `tests/unit/routes.test.ts` | 3 | keine toten Links in Navigation/Footer |

Die fünf Szenarien aus §27 sind einzeln benannt und laufen durch: E-Mail-Triage
mit Freigabe und Audit-Eintrag; quellenbasiertes Meeting-Briefing mit
Lückenkennzeichnung; Follow-up mit Freigabe, Versand und Kostenprotokoll;
Wissensfrage mit Quellen und Rechteprüfung; Rechnungserfassung mit fehlendem
Pflichtfeld, die zur Prüfaufgabe führt statt zu Zahlung oder Buchung.

---

## 3. Vollständig implementiert

**Fundament**

- Next.js 16.2.11 App Router, TypeScript strict, React 19, Tailwind CSS 4
- PostgreSQL 16 mit pgvector und pgcrypto, Drizzle ORM, 22 Migrationen
- Zwei Datenbankrollen: `workforce_app` (RLS-unterworfen), `workforce_owner`
  (Migrationen, Auth, Systemjobs)
- Sicherheits-Kopfzeilen auf jeder Antwort (per E2E-Test geprüft), Health-Endpunkt,
  CI-Workflow (lint, typecheck, test, build)

**Mandantenfähigkeit**

- RLS-Policy auf allen 24 mandantenbezogenen Tabellen; `withOrg()` setzt
  `app.org_id` per `set_config` innerhalb einer Transaktion
- Auth- und Plattformtabellen: **keine** Rechte für die App-Rolle
- Zusätzliches Scoping in der Datenzugriffsschicht (Defense in Depth)
- Belegt durch 9 Tests, die erwarten, dass Cross-Tenant-Zugriffe **an der
  Datenbank** scheitern — nicht an der Anwendung

**Auth und Rollen**

- Better Auth: E-Mail/Passwort, Verifikation, Passwort-Zurücksetzen, Sessions,
  Organisationen, Einladungen, optional TOTP
- Sechs Rollen mit getrennter Berechtigungsmatrix; serverseitige Durchsetzung
  über `requirePermission()`
- Letzte Person mit `owner` kann Rolle nicht abgeben und nicht entfernt werden

**Agentensystem**

- 57 Agenten als typisierter Katalog im Code; organisationsspezifische
  Konfiguration in der Datenbank
- Gemeinsame Runtime mit Phasen plan → retrieve → reason → draft → validate →
  request_approval → execute → verify → report
- Automatisierungsstufen 0–5 je Fähigkeit; `defineAgent()` deckelt jede
  Fähigkeit auf die zu ihrem Risiko passende Höchststufe (`high` → 3)
- 13 vertiefte, agentenspezifische Handler über 7 Agenten; 8 Archetyp-Handler
  für die übrigen — jeder verrichtet echte Arbeit
- Werkzeugaufruf nur bei Fähigkeitsbedarf **und** Instanz-Freigabe
- Grenzen je Lauf: 20 Schritte, 120 s, 2 € KI-Kosten, 15 Werkzeugaufrufe
- Idempotenzschlüssel; Abbruch durch Nutzer; vollständige Schritt-Timeline
- Freigaben nach dem „Prepared Action"-Muster: bei Freigabe wird **genau die
  gezeigte** Aktion ausgeführt, kein zweiter Lauf
- Sammelfreigabe serverseitig auf risikoarme, gleichartige Aktionen begrenzt
  (max. 25)
- Sandbox-Pflicht: kein Agent wird aktivierbar ohne bestandenen Testlauf

**Wissenssystem**

- Upload (PDF, DOCX, TXT, Markdown) → Extraktion → Chunking → Embedding
- Hybride Suche: pgvector-Kosinus (0,6) + deutsches `ts_rank` (0,4)
- Rechteprüfung **in der SQL-Abfrage**, nicht in der Anwendung
- Quellenpflicht: zitierte Fundstellen werden gegen die gelieferten Quellen
  geprüft; ohne Beleg keine Antwort

**Abrechnung**

- Vier Pläne, Agentenpreise nach vier Stufen, Department-Pakete,
  Preis-Overrides je Agent/Department/Stufe und optional je Organisation
- Preislogik ausschließlich serverseitig; der Client sendet nur Auswahlschlüssel
- Kontingentprüfung **vor** jedem Lauf; Verbrauch wird auch bei Abbruch und
  Fehler fortgeschrieben (keine Umgehung durch erzwungene Fehler)
- Gutscheine, Planwechsel, Kündigung, Rechnungserzeugung

**Integrationen**

- Demo-E-Mail- und Demo-Kalender-Connector (vollständig, End-to-End)
- Webhook-Endpunkt mit HMAC-SHA256 über `<timestamp>.<rohtext>`,
  `timingSafeEqual`, 300-Sekunden-Fenster, 64-KiB-Grenze
- CSV-Import/Export mit selbst geschriebenem RFC-4180-Parser, Teilimport mit
  Problemmeldung je Zeile
- Zugangsdaten AES-256-GCM verschlüsselt (`v1:<iv>:<tag>:<ciphertext>`)

**Hintergrund-Worker**

Ein eigener Prozess (`pnpm worker`) auf pg-boss, im eigenen Schema `pgboss` und
mit der Owner-Rolle. Fünf Takte: fällige Zeitpläne (jede Minute),
Agentenläufe mit zwei Wiederholungen und steigendem Abstand,
Tageszusammenfassungen (alle 15 Minuten), Abrechnung (täglich) und Verfall
offener Freigaben (alle 10 Minuten).

Die Zeitpläne liegen in der Anwendungsdatenbank, nicht in pg-boss — dadurch
unterliegen sie der Mandantentrennung, stehen im Audit-Log und sind ohne
Worker-Neustart änderbar. pg-boss liefert nur den Herzschlag.

| Eigenschaft | Umsetzung |
| --- | --- |
| Kein Doppellauf | Das Zeitfenster wird über ein bedingtes `UPDATE` **vor** dem Einreihen beansprucht. Zwei Worker, ein Neustart mitten im Takt oder ein wiederholter Job erzeugen keinen zweiten Lauf. Zusätzlich trägt jeder Lauf einen Idempotenzschlüssel aus Zeitplan und Fenster. |
| Vier Muster statt Cron | stündlich, täglich, werktäglich, wöchentlich — mit Uhrzeit und IANA-Zeitzone. Cron wäre mächtiger und die häufigste Quelle falsch gesetzter Zeitpläne. |
| Sommerzeit | Das Slot-Verfahren führt beim Rückstellen der Uhr keinen doppelten Lauf aus und lässt beim Vorstellen keinen ausfallen. Beide Fälle sind einzeln getestet. |
| Pausierte Agenten | Ein Zeitplan startet keinen Lauf für einen pausierten Agenten oder eine abgeschaltete Fähigkeit. Das Fenster bleibt unbeansprucht, sodass der Lauf nach dem Fortsetzen stattfindet. |
| Erschöpftes Kontingent | Wird nicht als Fehler wiederholt — Wiederholen würde daran nichts ändern. Der Grund steht am Zeitplan. |
| Dauerhafte Fehlläufe | Nach fünf Fehlläufen in Folge wird der Zeitplan abgeschaltet, im Audit-Log vermerkt und die Organisation benachrichtigt. Ohne diese Grenze würde ein falsch konfigurierter Agent jede Nacht Kontingent verbrauchen. |
| Endgültig gescheiterte Jobs | Landen in einer Endlager-Warteschlange und bleiben dort 30 Tage einsehbar, statt still zu verschwinden. |
| Geordnetes Herunterfahren | `SIGTERM`/`SIGINT` lassen laufende Jobs zu Ende gehen. |

Belegt durch 17 Integrationstests gegen die Datenbank und 20 Unit-Tests der
Fälligkeitsberechnung. Zusätzlich wurde der Worker-Prozess selbst gestartet: Er
hat einen fälligen Zeitplan gefunden, den Lauf ausgeführt (`trigger_type:
schedule`, 7 Schritte) und ihn in den folgenden Takten **nicht** wiederholt.

**Betreiberbereich**

- Organisationen, Preise, Feature Flags, Audit-Suche
- Plattformzugang **nur** über CLI mit Datenbankzugriff vergebbar — es gibt
  keinen Weg, sich diese Rechte aus der Anwendung heraus selbst zu geben
- Support-Einsicht erfordert eine Begründung und erscheint im Audit-Log **der
  betroffenen Organisation**

**Website**

- 19 Seiten inklusive Rechtstexten; keine toten Links (durch Test abgesichert,
  der Navigation und Footer aus dem Quelltext liest)
- Rechtstexte durchgehend als „Entwurf — juristisch zu prüfen" gekennzeichnet

**Auswertungen**

- Berichte ausschließlich aus echten Laufdaten; Sandbox-Läufe ausgeschlossen
- Kennzahlen ohne Datengrundlage bleiben leer und nennen den Grund. Einzige
  Schätzung: eingesparte Zeit über einen festen Minutenwert je Lauf — überall
  als Schätzung gekennzeichnet

**Plattforminterne Werkzeuge**

Sieben Werkzeuge, die keine externen Zugangsdaten brauchen und ausschließlich
auf eigenen Tabellen arbeiten:

| Werkzeug | Was es tut | Selbstbegrenzung |
| --- | --- | --- |
| `reports.generate` | Kennzahlen aus abgeschlossenen Läufen | Schätzcharakter der Zeitersparnis reist mit; Kosten von 0 werden als „kein echter Anbieter" gekennzeichnet |
| `knowledge.write` | Wissenseintrag anlegen | Herkunft `agent_knowledge` in der Datenbank **und** als Vermerk im Text; eingeschränkter Zugriff ohne berechtigte Rolle wird abgelehnt |
| `documents.write` | Dokument erzeugen | Titel und Zusammenfassung nennen es „Entwurf"; `approved: false` |
| `approvals.read` | Offene Freigaben lesen | Gibt die Nutzlast **nicht** heraus — sie kann fremde Inhalte enthalten, die ein lesender Agent als Anweisung missverstehen könnte |
| `agents.dispatch` | Arbeit an einen anderen Agenten übergeben | Keine Rekursion (ein delegierter Lauf delegiert nicht weiter), keine Selbstbeauftragung, nur aktive Agenten, nur eigene Fähigkeiten; der beauftragte Lauf gilt mit **seinen** Rechten und **seiner** Stufe |
| `agents.pause` | Einen Agenten anhalten | Mittleres Risiko → menschliche Freigabe; im Sandbox-Lauf wird nichts verändert; Begründung ab 10 Zeichen; idempotent |
| `pricing.calculate` | Positionen rechnen | Reine Arithmetik ohne Modell. Nicht-numerische Angaben werden abgelehnt, statt einen plausiblen Betrag zu erzeugen; der Steuersatz gilt als übernommen, nicht als geprüft |

**Fachdatenbestände (Tickets, Kontakte, Personal)**

Vier Tabellen (`ticket`, `contact`, `employee`, `absence`) mit RLS-Policies und
neun Werkzeugen darauf. Sie sind bewusst schlank — kein Ersatz für ein
gewachsenes CRM, Helpdesk oder HR-System, sondern der Datenbestand, auf dem die
Agenten arbeiten, solange kein Fremdsystem angebunden ist. Die
Werkzeugschnittstelle bleibt bei einem späteren Connector dieselbe; nur die
Quelle wechselt.

| Werkzeug | Schutzregel |
| --- | --- |
| `tickets.write` | Legt bei unbekannter Referenz **kein** neues Ticket an. Erste Reaktion und Lösungszeitpunkt werden nur beim tatsächlichen Eintritt gesetzt und nie überschrieben — sie sind Messgrößen. |
| `contacts.read` | Gesperrte Kontakte erscheinen standardmäßig **nicht** in Ergebnissen; ein Agent, der eine Ansprache vorbereitet, sieht sie gar nicht. |
| `contacts.write` | Kennt den Sperrvermerk nur in eine Richtung: setzen ja, aufheben nie. Erfindet keinen Namen aus einer E-Mail-Adresse. |
| `crm.write` | Legt keinen Vorgang an und verändert einen gesperrten Vorgang nicht. |
| `crm.read` | Weist keine Gesamtsumme aus, wenn bei einem Vorgang der Betrag fehlt — mit Begründung im Ergebnis. |
| `hr.read` | Liefert **keine** Abwesenheitsgründe (`note`) an den Lauf. Ein Krankheitsgrund gehört nicht in Protokolle oder Entwürfe. Vergütungs- und Gesundheitsfelder gibt es nicht einmal im Schema. |
| `hr.write` | Erfasst Anträge mit Status „beantragt" und setzt nie `decidedAt`. Ein Agent prüft die Form; entscheiden darf nur ein Mensch. Legt keine Personalstammdaten an. |
| `files.read` | Nennt die Wissensablage als Quelle und weist ausdrücklich aus, dass kein externer Dateispeicher angebunden ist. |

Damit sind es **54 von 57 Agenten mit vollem Datenzugang**; kein Agent ist mehr
ohne eigenen Datenzugang. Die drei verbleibenden (`lead-research`,
`travel-planning`, `research`) brauchen `web.research`.

Ergänzend: CSV-Import und Demo-Seed für die drei neuen Bestände, damit tatsächlich
Daten hineinkommen — sonst wären die Werkzeuge auf leeren Tabellen wirkungslos.

Drei Wirkungen davon sind erwähnenswert:

- Ein `loadDomainContext()`-Baustein lädt in **allen** Archetyp-Handlern die
  Fachdaten, die die Fähigkeit lesen darf, und übergibt sie als `<daten>`-Block.
  Das war der fehlende Schritt: Werkzeuge allein bewirken nichts, wenn kein
  Handler sie aufruft.

- Das Tagesbriefing des Chief of Staff liest offene Freigaben jetzt **direkt**.
  Vorher schloss es sie aus dem Aktivitätsprotokoll — das zählte Läufe statt
  Freigaben und übersah alles außerhalb der letzten 20 Ereignisse.
- Der Chief of Staff hat einen echten Delegations-Handler: Aufgaben werden
  regelbasiert einem Department zugeordnet und an gebuchte, aktive Agenten
  vorgelegt. Was sich nicht zuordnen lässt, bleibt beim Menschen und wird
  namentlich benannt — es wird kein Agent geraten.

---

## 4. Teilweise implementiert

| Bereich | Was steht | Was fehlt |
| --- | --- | --- |
| **Anthropic-Provider** | `AnthropicProvider` vollständig implementiert (Modell `claude-opus-5`, strukturierte Ausgaben, Token- und Kostenerfassung) | **Nie gegen die echte API ausgeführt** — kein Schlüssel in der Umgebung. Sämtliche Testergebnisse dieses Berichts stammen vom deterministischen `ScriptedProvider` |
| **Stripe** | Adapter implementiert, wird nur bei gesetztem `STRIPE_SECRET_KEY` instanziiert | **Nicht gegen die echte API getestet.** Die Webhook-Route für Abo-Statuswechsel fehlt vollständig — ohne sie bleibt bei echten Zahlungen der Abo-Status stehen |
| **Voyage-Embeddings** | `VoyageEmbeddingProvider` implementiert, 1024 Dimensionen | Nicht gegen die echte API getestet. Der lokale Ersatz kennt **keine Semantik**, nur Wortform-Ähnlichkeit über Wort-Hashes und Zeichen-Trigramme |
| **Gmail / Google Calendar** | Als Connector registriert, Status „Zugangsdaten erforderlich", im UI so gekennzeichnet | **Der OAuth-Flow und die Adapter-Implementierung fehlen.** Es existiert bislang nur der Registry-Eintrag, nicht der Code, der Gmail tatsächlich abfragt |
| **SMTP** | Adapter vorhanden; ohne `SMTP_URL` landen Mails in einer einsehbaren Outbox-Tabelle | Nicht gegen einen echten Server getestet |
| **Vertiefung der Agenten** | Alle 126 Fähigkeiten laufen real und sind einzeln getestet | 13 Handler über 7 Agenten sind fachlich vertieft. Die übrigen laufen über 8 Archetyp-Handler: echte Arbeit, aber geringere fachliche Tiefe. Das ist eine bewusste Entscheidung (ADR-008), kein Versehen |
| **Datenzugang der Agenten** | **54 der 57** Agenten haben alle benötigten Werkzeuge echt angebunden | 3 (`lead-research`, `travel-planning`, `research`) fehlt `web.research`. Sie arbeiten mit ihren übrigen Quellen und benennen die Lücke im Lauf |

### Was „läuft" für die drei nicht voll angebundenen Agenten bedeutet

Alle 57 Agenten führen jede ihrer Fähigkeiten aus und liefern ein verwertbares
Ergebnis — belegt durch `tests/integration/departments.test.ts`. Den drei
verbleibenden fehlt nur die Websuche: Sie nutzen ihre internen Quellen, benennen
die fehlende Anbindung im Lauf und in der Ausgabe (`unavailableTools`) und
**erfinden keine Daten**. Kein Agent ist mehr vollständig ohne Datenzugang.

---

## 5. Nicht implementiert

| Punkt | Grund | Auswirkung |
| --- | --- | --- |
| **Oberfläche für Zeitpläne** | Datenmodell, Worker und Server Actions sind fertig; die Ansicht zum Anlegen fehlt | Zeitpläne sind heute nur über die Server Actions bzw. direkt in der Datenbank setzbar |
| **Stripe-Webhook-Route** | benötigt `STRIPE_WEBHOOK_SECRET` und eine öffentlich erreichbare URL | Bei echten Zahlungen würde der Abo-Status nicht automatisch nachgeführt |
| **14 weitere Connectoren** (Outlook, Microsoft Calendar, Google Drive, OneDrive, Dropbox, Slack, Teams, HubSpot, Salesforce, Pipedrive, Notion, sevdesk, lexoffice, DATEV) | brauchen App-Registrierungen, Verträge und echte Konten zum Testen | Im UI als „Nicht implementiert" gekennzeichnet. Ein Kunde mit bestehendem HubSpot oder Zendesk arbeitet bis dahin auf den plattformeigenen Beständen (CSV-Import) statt auf seinem Fremdsystem |
| **`web.research`** | Braucht eine externe Suchschnittstelle und ausgehenden Netzzugriff | Das **einzige** der 33 Katalog-Werkzeuge, das ohne Drittanbieter grundsätzlich nicht umsetzbar ist. Betrifft `lead-research`, `travel-planning`, `research` |
| **Oberflächen für Tickets, Kontakte, Personal** | Die Tabellen und Werkzeuge existieren, eine eigene Verwaltungsansicht nicht | Daten kommen über CSV-Import, Webhook oder Demo-Seed hinein und über CSV-Export hinaus. Zum Pflegen einzelner Datensätze im Browser fehlen die Ansichten |
| **Externe Sicherheitsprüfung** | nicht durchgeführt | Wird nirgends behauptet. Das Bedrohungsmodell ist Eigenanalyse |
| **Verschlüsselung auf Feldebene für Inhalte** | würde die hybride Suche unmöglich machen | Aufgaben-, E-Mail- und Dokumenttexte liegen unverschlüsselt in der Datenbank. Schutz über Zugriffskontrolle und Speicherverschlüsselung auf Infrastrukturebene |
| **Rate Limiting am Rand** | gehört auf den Reverse Proxy | Anwendungsseitig nicht vorhanden |
| **Zwei-Faktor-Pflicht** | technisch vorhanden, Erzwingung ist eine Betreiberentscheidung | Nicht erzwungen |
| **Juristisch geprüfte Rechtstexte** | erfordert anwaltliche Prüfung | Impressum, Datenschutzerklärung und AGB sind Entwürfe und durchgehend als solche gekennzeichnet |

---

## 6. Benötigte Zugangsdaten

Ohne diese Schlüssel ist die Anwendung **vollständig bedienbar und testbar** —
der jeweilige Ersatz ist in der Oberfläche unter *Settings → Systemzustand*
gekennzeichnet.

| Variable | Ohne sie | Priorität |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | deterministischer, regelbasierter Provider statt LLM | Hoch |
| `STRIPE_SECRET_KEY` (+ `STRIPE_WEBHOOK_SECRET`) | simulierte Abrechnung, keine echte Zahlung | Hoch |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail und Google Calendar bleiben gesperrt | Hoch |
| `VOYAGE_API_KEY` | lokale Embeddings ohne Semantikverständnis | Mittel |
| `SMTP_URL` | E-Mails landen in der Outbox, werden nicht versendet | Mittel |

Pflicht für den Betrieb: `DATABASE_URL` (muss auf `workforce_app` zeigen),
`DATABASE_ADMIN_URL`, `AUTH_SECRET`, `CREDENTIAL_ENCRYPTION_KEY` (64 Hex-Zeichen),
`APP_URL`.

Es liegen keine echten Zugangsdaten im Repository. `.env*` ist über
`.gitignore` ausgeschlossen; die einzige eingecheckte Env-Datei ist
`.env.example`. Sie enthält lokale Entwicklungswerte (Passwörter der lokalen
Datenbankrollen, ein als `dev-only-secret-change-me-please` benannter
Auth-Wert, ein Beispiel-Verschlüsselungsschlüssel) und für jeden davon den
Hinweis, ihn für Produktion neu zu erzeugen (`openssl rand -hex 32`). Alle
Zugangsdaten externer Anbieter stehen dort ausschließlich auskommentiert mit
Formatbeispiel.

---

## 7. Sicherheitsrisiken

### Bekannte Restrisiken

| Risiko | Bewertung | Minderung |
| --- | --- | --- |
| Eine Abfrage über `adminDb` umgeht RLS | **hoch, wenn es passiert** | `adminDb` ist auf Migrationen, Auth, Audit-Schreibzugriffe und den Plattformbereich begrenzt. Jede weitere Verwendung gehört ins Review. Technisch verhindert nichts einen Fehlgriff |
| Prompt Injection beeinflusst die *Formulierung* eines Entwurfs | mittel | Fremde Inhalte in `<daten>`-Blöcken; Aktionen mit Außenwirkung auf Stufe 3 gedeckelt; die Wirkung bleibt auf einen Entwurf begrenzt, den ein Mensch sieht |
| Owner-Rollen-Datenbankzugriff umgeht alle Kontrollen | hoch | Keine Eigenschaft dieser Anwendung, sondern von Datenbankadministration. Nur organisatorisch begrenzbar |
| Inhalte unverschlüsselt in der Datenbank | mittel | Bewusste Entscheidung (Suche); Zugriffskontrolle plus Speicherverschlüsselung |
| Webhook-Ereignisse bei gestohlenem Geheimnis **und** Schlüssel | niedrig | Ein Webhook kann nur eine Aufgabe erzeugen, keine Aktion mit Außenwirkung auslösen |
| Kein Rate Limiting | mittel | Muss auf dem Reverse Proxy ergänzt werden, bevor die Anwendung öffentlich erreichbar ist |

### Was geprüft wurde

Sieben Tests mit eingeschmuggelten Anweisungen in Dokumenten und E-Mails; acht
RLS-Tests mit Cross-Tenant-Zugriffen; acht Tests des Betreiberzugangs; elf Tests
der Webhook-Signatur inklusive Replay und manipulierter Nutzlast; zwanzig Tests
der Selbstbegrenzungen der Plattform-Werkzeuge (Delegationsrekursion,
Selbstbeauftragung, Sandbox-Wirkung, Beträge, Herkunft).

### Was nicht geprüft wurde

Keine externe Sicherheitsprüfung. Kein Penetrationstest. Keine
Lastprüfung. Die Bewertung oben ist Eigenanalyse.

---

## 8. Nächste Schritte

**Vor einem Produktivbetrieb erforderlich**

1. **`AUTH_SECRET` und `CREDENTIAL_ENCRYPTION_KEY` erzeugen** und sicher
   ablegen. Die Anwendung verweigert in Produktion den Start mit dem
   Entwicklungswert für `AUTH_SECRET`.
2. **`DATABASE_URL` prüfen** — zeigt sie auf die Owner-Rolle, ist die
   Mandantentrennung wirkungslos. Das ist der teuerste einzelne
   Konfigurationsfehler, den man hier machen kann.
3. **Rate Limiting auf dem Reverse Proxy** einrichten.
4. **Rechtstexte juristisch prüfen** lassen (Impressum, Datenschutzerklärung,
   AGB, Auftragsverarbeitungsvertrag).
5. **Anthropic-Schlüssel setzen und die Agenten gegen das echte Modell prüfen.**
   Der Adapter ist implementiert, aber nie live ausgeführt worden — hier ist mit
   Nacharbeit an den Prompts zu rechnen, insbesondere bei den strukturierten
   Ausgaben.

**Danach, nach Nutzwert geordnet**

6. **Worker unter eine Prozessverwaltung stellen** — er ist implementiert und
   geprüft, aber ein einzelner Prozess. Ohne Neustart nach Absturz ruhen
   Zeitpläne. systemd, Docker-Restart-Policy oder ein
   Kubernetes-Deployment genügen.
7. **Stripe-Webhook-Route** ergänzen und den Adapter gegen den Test-Modus
   verifizieren.
8. **Verwaltungsansichten für Tickets, Kontakte und Personal** — die Tabellen
   und Werkzeuge stehen, aber einzelne Datensätze lassen sich im Browser nicht
   pflegen. Heute geht das nur über CSV-Import/-Export und Webhook.
9. **Gmail- und Google-Calendar-Adapter tatsächlich schreiben** — bislang
   existiert nur der Registry-Eintrag. Die Demo-Connectoren definieren dafür
   das Zielverhalten.
10. **Voyage-Embeddings aktivieren** und alle Dokumente neu einlesen. Ohne
    Neuindexierung liefert die Suche nach dem Providerwechsel Zufallstreffer.
11. **`web.research` anbinden** — braucht eine Suchschnittstelle und
    ausgehenden Netzzugriff. Bis dahin bleibt `lead-research` ohne eigenen
    Datenzugang.
12. **Weitere Agenten vertiefen** — die Archetyp-Handler arbeiten, gewinnen aber
    durch fachspezifische Regeln. Reihenfolge nach tatsächlicher Nutzung.
13. **Externe Sicherheitsprüfung** beauftragen.

---

## 9. Wo etwas von der Vorgabe abweicht

| Vorgabe | Umsetzung | Grund |
| --- | --- | --- |
| Supabase als Datenbank vorgeschlagen | lokales PostgreSQL 16 mit Drizzle | Keine Supabase-Zugangsdaten verfügbar. Drizzle erzeugt SQL-Migrationen, in denen echte RLS-Policies formuliert werden — die Mandantentrennung liegt damit in der Datenbank |
| 48 Agenten + Chief of Staff | 57 Agenten (7 × 8 + Chief of Staff) | Die Departmentliste der Vorgabe ergibt bei acht Agenten je Fachbereich 56 plus Chief of Staff |
| shadcn/ui | handgeschriebene Komponenten im shadcn-Stil auf Radix-Primitiven | `ui.shadcn.com` ist durch die Netzwerkregeln dieser Umgebung nicht erreichbar; das CLI konnte nicht laufen |
| Jede Fähigkeit mit eigener Logik | 13 vertiefte Handler + 8 Archetyp-Handler für 126 Fähigkeiten | 126 einzelne Implementierungen wären redundant und schlechter testbar. Die Zuordnung steht explizit im Code und ein Test verhindert, dass eine Fähigkeit auf eine Rückfallebene fällt (ADR-008) |
| Automatisierungsstufen bis 5 | 11 Fähigkeiten mit Risiko `hoch` fest auf 3 gedeckelt | Bindende Vorgabe §4.11: Aktionen mit finanzieller, rechtlicher, personeller oder Reputationsfolge erfordern menschliche Freigabe. Drei Katalogeinträge erlaubten zunächst Stufe 4 — das war ein echter Widerspruch und wurde korrigiert |

---

## 10. Was dieses Produkt nicht leistet

Ausdrücklich festgehalten, weil es im Marketing leicht verloren geht:

- Keine autonome Unternehmensführung. Was Außenwirkung hat, wird vorbereitet
  und von einem Menschen entschieden.
- Kein Ersatz für rechtliche, steuerliche, medizinische oder andere regulierte
  Fachberatung.
- Kein Ersatz für Fachpersonal. Die Agenten bereiten Arbeit vor.
- Entwurf, Empfehlung, Freigabe und tatsächliche Ausführung sind vier
  getrennte Zustände — im Datenmodell, in der Oberfläche und im Protokoll.
