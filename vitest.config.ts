import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/rls/**/*.test.ts",
    ],
    passWithNoTests: true,
    setupFiles: ["tests/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: "forks",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` wirft außerhalb einer React-Server-Umgebung; in
      // Node-Integrationstests wird es durch einen No-op ersetzt.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
