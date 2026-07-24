/**
 * Vitest-Setup: Tests laufen gegen die Test-Datenbank `workforce_test`,
 * niemals gegen die Dev-/Prod-Datenbank.
 */
Object.assign(process.env, { NODE_ENV: "test" });
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://workforce_app:workforce_app_dev@localhost:5432/workforce_test";
process.env.DATABASE_ADMIN_URL =
  process.env.TEST_DATABASE_ADMIN_URL ??
  "postgres://workforce_owner:workforce_owner_dev@localhost:5432/workforce_test";
