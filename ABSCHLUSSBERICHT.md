# Abschlussbericht — WORKFORCE OS

Stand: 25. Juli 2026 · Branch `claude/workforce-os-saas-platform-ynbpza`

Dieser Bericht nennt den geprüften Stand. Wo etwas fehlt, unvollständig oder
ungetestet ist, steht das hier — nicht in einer Fußnote.

---

## 1. Kennzahlen

| | |
| --- | --- |
| Quelldateien (`src/`) | 210 (TypeScript/TSX), ca. 33.100 Zeilen |
| Datenbanktabellen | 33, davon 19 mandantenbezogen mit RLS-Policy |
| SQL-Migrationen | 17 |
| Agenten im Katalog | 57 über 8 Departments (7 Fachbereiche + Chief of Staff) |
| Fähigkeiten | 126 (Risiko: 88 niedrig, 27 mittel, 11 hoch) |
| Runtime-Werkzeuge | 33 vom Katalog referenziert, **16 echt implementiert**, 17 Platzhalter mit klarer Fehlermeldung |
| Seiten | 19 Marketing, 18 App, 5 Admin, 3 API-Routen |
| UI-Komponenten | 42 |
| Tests | **136 Vitest** (20 Dateien) + **31 Playwright** = 167 |

---

## 2. Testergebnisse (selbst ausgeführt, letzter Durchlauf)

```
pnpm lint       → keine Meldungen
pnpm typecheck  → keine Fehler
pnpm test       → Test Files 20 passed (20) | Tests 136 passed (136)  [8,29 s]
pnpm build      → erfolgreich, 54 Routen
pnpm e2e        → 31 passed (12,6 s)
```

Die Vitest-Suite läuft gegen eine echte PostgreSQL-16-Datenbank
(`workforce_test`) mit dem deterministischen KI-Provider. Playwright läuft gegen
`next start` — nicht gegen den Dev-Server.

### Verteilung

| Datei | Tests | Gegenstand |
| --- | --- | --- |
| `tests/rls/tenant-isolation.test.ts` | 8 | Mandantentrennung gegen die echte DB |
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
- PostgreSQL 16 mit pgvector und pgcrypto, Drizzle ORM, 17 Migrationen
- Zwei Datenbankrollen: `workforce_app` (RLS-unterworfen), `workforce_owner`
  (Migrationen, Auth, Systemjobs)
- Sicherheits-Kopfzeilen auf jeder Antwort (per E2E-Test geprüft), Health-Endpunkt,
  CI-Workflow (lint, typecheck, test, build)

**Mandantenfähigkeit**

- RLS-Policy auf allen 19 mandantenbezogenen Tabellen; `withOrg()` setzt
  `app.org_id` per `set_config` innerhalb einer Transaktion
- Auth- und Plattformtabellen: **keine** Rechte für die App-Rolle
- Zusätzliches Scoping in der Datenzugriffsschicht (Defense in Depth)
- Belegt durch 8 Tests, die erwarten, dass Cross-Tenant-Zugriffe **an der
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
- 12 vertiefte, agentenspezifische Handler über 7 Agenten; 8 Archetyp-Handler
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

---

## 4. Teilweise implementiert

| Bereich | Was steht | Was fehlt |
| --- | --- | --- |
| **Anthropic-Provider** | `AnthropicProvider` vollständig implementiert (Modell `claude-opus-5`, strukturierte Ausgaben, Token- und Kostenerfassung) | **Nie gegen die echte API ausgeführt** — kein Schlüssel in der Umgebung. Sämtliche Testergebnisse dieses Berichts stammen vom deterministischen `ScriptedProvider` |
| **Stripe** | Adapter implementiert, wird nur bei gesetztem `STRIPE_SECRET_KEY` instanziiert | **Nicht gegen die echte API getestet.** Die Webhook-Route für Abo-Statuswechsel fehlt vollständig — ohne sie bleibt bei echten Zahlungen der Abo-Status stehen |
| **Voyage-Embeddings** | `VoyageEmbeddingProvider` implementiert, 1024 Dimensionen | Nicht gegen die echte API getestet. Der lokale Ersatz kennt **keine Semantik**, nur Wortform-Ähnlichkeit über Wort-Hashes und Zeichen-Trigramme |
| **Gmail / Google Calendar** | Als Connector registriert, Status „Zugangsdaten erforderlich", im UI so gekennzeichnet | **Der OAuth-Flow und die Adapter-Implementierung fehlen.** Es existiert bislang nur der Registry-Eintrag, nicht der Code, der Gmail tatsächlich abfragt |
| **SMTP** | Adapter vorhanden; ohne `SMTP_URL` landen Mails in einer einsehbaren Outbox-Tabelle | Nicht gegen einen echten Server getestet |
| **Vertiefung der Agenten** | Alle 126 Fähigkeiten laufen real und sind einzeln getestet | 12 Handler über 7 Agenten sind fachlich vertieft. Die übrigen laufen über 8 Archetyp-Handler: echte Arbeit, aber geringere fachliche Tiefe. Das ist eine bewusste Entscheidung (ADR-008), kein Versehen |

---

## 5. Nicht implementiert

| Punkt | Grund | Auswirkung |
| --- | --- | --- |
| **Hintergrund-Worker (pg-boss)** | `pg-boss` ist als Abhängigkeit installiert, aber **nirgends verwendet**; `src/server/jobs/` existiert nicht | Läufe starten synchron über Server Actions. **Zeitgesteuerte Läufe und Hintergrund-Retries funktionieren nicht.** Der Feature-Flag „Zeitpläne" ist im Adminbereich als wirkungslos gekennzeichnet |
| **Automatische Rechnungsstellung** | derselbe fehlende Worker | `issueInvoice()` läuft nur auf Anforderung über die Billing-Seite |
| **Stripe-Webhook-Route** | benötigt `STRIPE_WEBHOOK_SECRET` und eine öffentlich erreichbare URL | Bei echten Zahlungen würde der Abo-Status nicht automatisch nachgeführt |
| **14 weitere Connectoren** (Outlook, Microsoft Calendar, Google Drive, OneDrive, Dropbox, Slack, Teams, HubSpot, Salesforce, Pipedrive, Notion, sevdesk, lexoffice, DATEV) | brauchen App-Registrierungen, Verträge und echte Konten zum Testen | Im UI als „Nicht implementiert" gekennzeichnet. Die zugehörigen 17 Runtime-Werkzeuge werfen einen klaren Fehler statt Ergebnisse vorzutäuschen |
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
der Webhook-Signatur inklusive Replay und manipulierter Nutzlast.

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

6. **pg-boss-Worker bauen** (`src/server/jobs/`) — schaltet zeitgesteuerte
   Läufe, Hintergrund-Retries und automatische Rechnungsstellung frei. Der
   größte einzelne funktionale Zugewinn.
7. **Stripe-Webhook-Route** ergänzen und den Adapter gegen den Test-Modus
   verifizieren.
8. **Gmail- und Google-Calendar-Adapter tatsächlich schreiben** — bislang
   existiert nur der Registry-Eintrag. Die Demo-Connectoren definieren dafür
   das Zielverhalten.
9. **Voyage-Embeddings aktivieren** und alle Dokumente neu einlesen. Ohne
   Neuindexierung liefert die Suche nach dem Providerwechsel Zufallstreffer.
10. **Weitere Agenten vertiefen** — die Archetyp-Handler arbeiten, gewinnen aber
    durch fachspezifische Regeln. Reihenfolge nach tatsächlicher Nutzung.
11. **Externe Sicherheitsprüfung** beauftragen.

---

## 9. Wo etwas von der Vorgabe abweicht

| Vorgabe | Umsetzung | Grund |
| --- | --- | --- |
| Supabase als Datenbank vorgeschlagen | lokales PostgreSQL 16 mit Drizzle | Keine Supabase-Zugangsdaten verfügbar. Drizzle erzeugt SQL-Migrationen, in denen echte RLS-Policies formuliert werden — die Mandantentrennung liegt damit in der Datenbank |
| 48 Agenten + Chief of Staff | 57 Agenten (7 × 8 + Chief of Staff) | Die Departmentliste der Vorgabe ergibt bei acht Agenten je Fachbereich 56 plus Chief of Staff |
| shadcn/ui | handgeschriebene Komponenten im shadcn-Stil auf Radix-Primitiven | `ui.shadcn.com` ist durch die Netzwerkregeln dieser Umgebung nicht erreichbar; das CLI konnte nicht laufen |
| Jede Fähigkeit mit eigener Logik | 12 vertiefte Handler + 8 Archetyp-Handler für 126 Fähigkeiten | 126 einzelne Implementierungen wären redundant und schlechter testbar. Die Zuordnung steht explizit im Code und ein Test verhindert, dass eine Fähigkeit auf eine Rückfallebene fällt (ADR-008) |
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
