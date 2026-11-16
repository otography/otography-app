import { defineConfig } from "drizzle-kit";

// ローカルは `turso dev --db-file local.db`（http://127.0.0.1:8080）を想定。
export default defineConfig({
  dialect: "turso",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "http://127.0.0.1:8080",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
