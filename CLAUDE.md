@AGENTS.md

# WORKFORCE OS — Projektleitfaden

- Mandantenfähige SaaS-Plattform für digitale KI-Mitarbeiter. Plan: siehe docs/ und TODO.md.
- Sprache: UI Deutsch-first, Code/Identifier Englisch.
- DB: PostgreSQL 16 lokal (`workforce_dev`/`workforce_test`), Drizzle ORM.
  - `db`/`withOrg()` (RLS-Rolle workforce_app) für alle Mandanten-Queries.
  - `adminDb` (Owner-Rolle) NUR für Migrationen/Auth/Systemjobs.
- Befehle: pnpm lint | typecheck | test | build | db:generate | db:migrate | db:migrate:test | e2e
- Next 16: `proxy.ts` statt `middleware.ts`; params/searchParams sind Promises (Docs: node_modules/next/dist/docs/).
- Keine Secrets committen. Externe Provider (Anthropic/Stripe/Voyage/SMTP/Google) sind optional; ohne Keys laufen Mock-/Demo-Provider.
