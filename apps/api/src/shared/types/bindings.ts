export type Bindings = {
  AUTH_COOKIE_DOMAIN: string | undefined;
  AUTH_OAUTH_STATE_SECRET: string;
  // セッション暗号化キーリング（JSON文字列）
  // 本番: Cloudflare Secrets Store 経由（SecretsStoreSecret）
  // ローカル/vitest: 文字列として直接注入
  AUTH_SESSION_KEY_RING: string | { get: () => Promise<string> };
  APP_FRONTEND_URL: string;
  APPLE_KEY_ID: string;
  APPLE_TEAM_ID: string;
  APPLE_PRIVATE_KEY: string;
  DATABASE_URL: string;
  FIREBASE_API_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_PROJECT_ID: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_OAUTH_REDIRECT_URI: string;
  LIKE_RATE_LIMITER: RateLimit;
  AUTH_SIGNIN_RATE_LIMITER: RateLimit;
  AUTH_SIGNUP_RATE_LIMITER: RateLimit;
  AUTH_GOOGLE_RATE_LIMITER: RateLimit;
  CONTENT_RATE_LIMITER: RateLimit;
};
