# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** Required env vars, external API keys/services, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## API Environment Variables

| Variable                    | Status          | Description                                                                |
| --------------------------- | --------------- | -------------------------------------------------------------------------- |
| `AUTH_OAUTH_STATE_SECRET`   | **Existing**    | HMAC-SHA256 key for OAuth state JWT signing (jose). Already in .dev.vars.  |
| `GOOGLE_CLIENT_ID`          | **Needs value** | Google OAuth 2.0 Client ID. Placeholder exists in `.dev.vars.example`.     |
| `GOOGLE_CLIENT_SECRET`      | **Needs value** | Google OAuth 2.0 Client Secret. Placeholder exists in `.dev.vars.example`. |
| `GOOGLE_OAUTH_REDIRECT_URI` | **Needs value** | OAuth callback URI. Dev: `http://localhost:3000/api/auth/google/callback`. |
| `AUTH_ENCRYPTION_KEY`       | **Existing**    | AES-256-GCM key for refresh token encryption. 64-char hex.                 |
| `FIREBASE_API_KEY`          | **Existing**    | Firebase Web API Key for Identity Toolkit REST calls.                      |
| `FIREBASE_PRIVATE_KEY`      | **Existing**    | Firebase service account private key for Admin SDK.                        |
| `FIREBASE_CLIENT_EMAIL`     | **Existing**    | Firebase service account email.                                            |
| `FIREBASE_PROJECT_ID`       | **Existing**    | Firebase project ID.                                                       |
| `DATABASE_URL`              | **Existing**    | PostgreSQL connection string.                                              |
| `APP_FRONTEND_URL`          | **Existing**    | Frontend URL for CORS and redirects (http://localhost:3000).               |
| `AUTH_COOKIE_DOMAIN`        | **Existing**    | Cookie domain (localhost in dev).                                          |

## Google Cloud Console Setup

1. Navigate to **APIs & Services → Credentials**
2. Find the OAuth 2.0 Client ID used by Firebase
3. Add redirect URI: `http://localhost:3000/api/auth/google/callback` (dev), `https://<prod-domain>/api/auth/google/callback` (prod)

## Firebase Console Setup

1. Navigate to **Authentication → Sign-in method**
2. Enable **Google** provider (if not already enabled)

## jose Dependency

`jose` is installed as a direct dependency in `apps/api/package.json` for OAuth state JWT signing.

## Web App Environment Variables

| Variable              | Status          | Description                                                                         |
| --------------------- | --------------- | ----------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | **Needs value** | API URL for Hono RPC client and `/api/:path*` rewrite. Dev: `http://localhost:3001` |
