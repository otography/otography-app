import { defineConfig } from "drizzle-kit";

// ローカルは `turso dev --db-file local.db`（http://127.0.0.1:8080）を想定。
export default defineConfig({
  dialect: "turso",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "http://127.0.0.1:8080",
    // 空文字のトークンは「無し」として扱う。.env.example の TURSO_AUTH_TOKEN= を読み込むと空文字になり、
    // drizzle-kit は空文字を「トークンが足りない」と見なして止まるため。
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  },
});
