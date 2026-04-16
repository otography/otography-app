# Architecture

How the system works — components, relationships, data flows, invariants.

---

## Monorepo Structure

```
apps/api     → Hono API server (Cloudflare Workers, port 3001)
apps/web     → Next.js 16 App Router (port 3000)
packages/firebase-auth-rest → Firebase Admin SDK (REST-based, Cloudflare-compatible)
packages/errors              → Shared error classes (errore-based)
```

## Auth Architecture

### Session Flow (existing — email/password)

```
Browser → POST /api/auth/sign-in {email, password}
       → API calls Firebase Identity Toolkit: signInWithPassword
       → Firebase returns {idToken, refreshToken}
       → API calls Firebase Admin: createSessionCookie(idToken)
       → API sets otography_session cookie (HttpOnly, 5-day)
       → API encrypts + sets otography_refresh_token cookie (HttpOnly, 10-day)
       → Browser redirects to /account
```

### Session Refresh (existing)

When `otography_session` expires but `otography_refresh_token` exists:

1. Middleware detects invalid session cookie
2. Decrypts refresh token cookie (AES-256-GCM)
3. Exchanges refresh token via Firebase Secure Token API
4. Creates new session cookie from new idToken
5. Sets both cookies and continues the request

### Google OAuth Flow (NEW)

```
Browser → GET /api/auth/google
       → API generates state JWT (jose HS256, 5min expiry, includes redirect URL)
       → 302 redirect to Google OAuth consent URL
       → User consents on Google
       → Google redirects to GET /api/auth/google/callback?code=...&state=...
       → API verifies state JWT
       → API exchanges code for Google tokens (oauth2.googleapis.com/token)
       → API calls Firebase signInWithIdp with Google ID token
       → Firebase returns {idToken, refreshToken, isNewUser, needConfirmation, ...}
       → API creates session cookie + refresh token cookie (same as password flow)
       → 302 redirect: /setup-profile (new user) or /account (existing user)
```

### Error Handling in OAuth Flow

- Invalid/expired state → redirect to /login?error=invalid_state
- Google token exchange failure → redirect to /login?error=oauth_failed
- Firebase signInWithIdp failure → redirect to /login?error=firebase_auth_failed
- needConfirmation (email conflict) → redirect to /login?error=account_exists

## Key Invariants

1. **No client-side auth SDKs** — Web never loads Firebase or Google client SDK
2. **All credentials server-side** — Tokens, secrets, keys only exist in API
3. **Session cookies for auth** — Same mechanism regardless of auth method
4. **Errore pattern** — Functions return Error objects, never throw
5. **CSRF via state JWT** — OAuth callback uses signed state parameter, not CSRF middleware
6. **Encrypted refresh tokens** — AES-256-GCM encryption before storing in cookie
