import "dotenv/config";
import { spawn } from "node:child_process";

/**
 * Startet die Anwendung für Playwright-Tests gegen die Test-Datenbank.
 *
 * Bewusst der Produktions-Server (`next start`) statt `next dev`: Die E2E-Tests
 * sollen dasselbe Verhalten prüfen, das später ausgeliefert wird — inklusive
 * Proxy und Security-Kopfzeilen. Voraussetzung ist ein vorheriger `pnpm build`.
 *
 * Die Test-Datenbank wird über DATABASE_URL/DATABASE_ADMIN_URL erzwungen,
 * damit ein E2E-Lauf niemals Entwicklungsdaten verändert.
 */

const PORT = process.env.E2E_PORT ?? "3100";
const TEST_DB_APP =
  process.env.E2E_DATABASE_URL ??
  "postgres://workforce_app:workforce_app_dev@localhost:5432/workforce_test";
const TEST_DB_ADMIN =
  process.env.E2E_DATABASE_ADMIN_URL ??
  "postgres://workforce_owner:workforce_owner_dev@localhost:5432/workforce_test";

const DEV_DEFAULT_SECRET = "dev-only-secret-change-me-please";

/**
 * `next start` läuft mit NODE_ENV=production; env.ts weist dort den
 * Entwicklungs-Standardwert für AUTH_SECRET zurück — zu Recht. Für den
 * Testlauf wird deshalb ein eigenes Secret gesetzt, sobald in der Umgebung nur
 * der Standardwert steht. Ein echtes, gesetztes Secret wird respektiert.
 */
const authSecret =
  !process.env.AUTH_SECRET || process.env.AUTH_SECRET === DEV_DEFAULT_SECRET
    ? "e2e-only-secret-not-for-production-use"
    : process.env.AUTH_SECRET;

const child = spawn("pnpm", ["exec", "next", "start", "--port", PORT], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: TEST_DB_APP,
    DATABASE_ADMIN_URL: TEST_DB_ADMIN,
    APP_URL: `http://localhost:${PORT}`,
    AUTH_SECRET: authSecret,
    ALLOW_DEMO_SEED: "true",
  },
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code) => process.exit(code ?? 0));
