import { defineConfig, devices } from "@playwright/test";

/**
 * E2E-Tests laufen gegen einen lokalen Next.js-Server mit Test-Datenbank.
 * Chromium ist in der Umgebung vorinstalliert (PLAYWRIGHT_BROWSERS_PATH).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Die Umgebung liefert Chromium vorinstalliert, aber in einer
          // anderen Revision als die installierte Playwright-Version erwartet
          // (und ohne den Headless-Shell-Build). Deshalb wird der Pfad
          // explizit gesetzt, statt einen Download anzustoßen.
          // Überschreibbar über PLAYWRIGHT_CHROMIUM_PATH.
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
        },
      },
    },
  ],
  webServer: {
    command: "pnpm e2e:server",
    url: "http://localhost:3100/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
