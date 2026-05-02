import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// CI環境（.dev.varsなし）でもテストが実行できるよう、
// wrangler.jsoncにないenv変数（secrets）のダミー値を定義する
const testSecrets = {
  FIREBASE_CLIENT_EMAIL: "test@example.iam.gserviceaccount.com",
  FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  AUTH_OAUTH_STATE_SECRET: "test-oauth-state-secret-for-ci",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  AUTH_ENCRYPTION_KEY: "0".repeat(64),
};

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: testSecrets,
      },
    }),
  ],
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.db.test.ts"],
    setupFiles: ["./src/__tests__/setup.ts"],
  },
});
