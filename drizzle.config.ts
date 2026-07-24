import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema/index.ts",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_ADMIN_URL ??
      "postgres://workforce_owner:workforce_owner_dev@localhost:5432/workforce_dev",
  },
  strict: true,
  verbose: true,
});
