import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// テスト用ダミーキーリングJSON（32バイト = 64 hex文字のダミーキー）
const TEST_KEY_RING = JSON.stringify({
  v: 1,
  activeKeyId: "test-key-1",
  keys: [{ id: "test-key-1", hex: "a".repeat(64) }],
});

// wrangler.jsonc の vars を env.dev/production に分けたため、
// トップレベル vars が空になりテスト環境にバインドされなくなった。
// dev 環境と同じ値 + secrets のダミーを miniflare.bindings で注入する。
const testBindings = {
  // env.dev.vars と同じ値
  APP_FRONTEND_URL: "http://localhost:3000",
  FIREBASE_API_KEY: "test-firebase-api-key",
  FIREBASE_PROJECT_ID: "otography-676f1",
  AUTH_COOKIE_DOMAIN: "localhost",
  GOOGLE_OAUTH_REDIRECT_URI: "http://localhost:3000/api/auth/google/callback",
  // secrets（CI 環境用ダミー）
  FIREBASE_CLIENT_EMAIL: "test@example.iam.gserviceaccount.com",
  FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
  DATABASE_URL: "*************************************/test",
  AUTH_OAUTH_STATE_SECRET: "test-oauth-state-secret-for-ci",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  // セッション暗号化キーリング（JSON文字列）
  AUTH_SESSION_KEY_RING: TEST_KEY_RING,
};

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: testBindings,
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
