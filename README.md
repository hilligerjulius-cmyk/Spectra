# WORKFORCE OS

**Build your digital workforce.** — Stellen Sie Ihr digitales Team zusammen.

Mandantenfähige SaaS-Plattform für digitale KI-Mitarbeiter: Unternehmen wählen
spezialisierte Agenten oder komplette Departments, verbinden ihre Systeme und
verwalten alles über ein zentrales Dashboard — mit klaren Berechtigungen,
Automatisierungsstufen und menschlichen Freigaben.

## Status

In aktiver Entwicklung. Siehe [TODO.md](./TODO.md) für offene Punkte und
[docs/](./docs/) für Architektur, Datenmodell und Leitfäden.

## Tech-Stack

- **Frontend/Backend**: Next.js 16 (App Router), TypeScript (strict), React 19
- **UI**: Tailwind CSS 4, Radix-Primitives (shadcn-Stil), lucide-react, Recharts
- **Datenbank**: PostgreSQL 16 + pgvector, Drizzle ORM, Row Level Security
- **Auth**: Better Auth (E-Mail/Passwort, Verifikation, Organisationen, Rollen)
- **Jobs/Queue**: pg-boss (Postgres-basiert, Retries, Scheduling)
- **KI**: Anthropic (Provider-Abstraktion; deterministischer Scripted-Provider
  als Fallback ohne API-Key), Voyage-Embeddings mit lokalem Fallback
- **Billing**: Stripe (Test-Modus) mit Mock-Fallback, serverseitige Preislogik

## Lokale Installation

Voraussetzungen: Node 22+, pnpm 10+, PostgreSQL 16 mit `pgvector`.

```bash
# 1. Abhängigkeiten
pnpm install

# 2. Datenbank-Rollen & -Datenbanken anlegen (einmalig)
sudo -u postgres psql <<'SQL'
CREATE ROLE workforce_owner LOGIN PASSWORD 'workforce_owner_dev' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE workforce_app LOGIN PASSWORD 'workforce_app_dev' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE workforce_dev OWNER workforce_owner;
CREATE DATABASE workforce_test OWNER workforce_owner;
SQL
for db in workforce_dev workforce_test; do
  sudo -u postgres psql -d "$db" \
    -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pgcrypto;" \
    -c "GRANT USAGE, CREATE ON SCHEMA public TO workforce_owner; GRANT USAGE ON SCHEMA public TO workforce_app;"
done

# 3. Environment konfigurieren
cp .env.example .env   # Werte anpassen; ohne externe Keys läuft der Demo-Modus

# 4. Migrationen
pnpm db:migrate
pnpm db:migrate:test

# 5. Entwicklung starten
pnpm dev
```

## Wichtige Befehle

| Befehl | Zweck |
| --- | --- |
| `pnpm dev` | Entwicklungsserver (http://localhost:3000) |
| `pnpm build` / `pnpm start` | Produktionsbuild / -server |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript-Prüfung |
| `pnpm db:generate` | Drizzle-Migration aus Schema generieren |
| `pnpm db:migrate` | Migrationen ausführen (Dev-DB) |
| `pnpm test` | Unit-/Integrations-/RLS-Tests (Vitest, Test-DB) |
| `pnpm e2e` | End-to-End-Tests (Playwright) |
| `pnpm db:seed:demo` | Demo-Organisation mit gekennzeichneten Seed-Daten |

## Ohne externe Zugangsdaten

Die Plattform ist ohne Drittanbieter-Keys vollständig nutzbar und testbar:

- **KI**: deterministischer `ScriptedProvider` statt Anthropic-API
- **Billing**: `MockBillingProvider`, im UI als „Simulierte Abrechnung" markiert
- **E-Mail**: Outbox in der Datenbank statt SMTP-Versand
- **Integrationen**: Demo-E-Mail-/Demo-Kalender-Connector, Webhook, CSV

Echte Provider (Anthropic, Stripe, Voyage, SMTP, Google OAuth) aktivieren sich
automatisch, sobald die jeweiligen Environment-Variablen gesetzt sind — siehe
[.env.example](./.env.example).

## Dokumentation

Alle Dokumente liegen unter [docs/](./docs/): Architektur & ADRs, Datenmodell,
Agenten-Entwicklungsleitfaden, Integrationsleitfaden, Sicherheits- und
Datenschutzkonzept, Deployment, Test- und Admin-/Nutzerhandbuch.
