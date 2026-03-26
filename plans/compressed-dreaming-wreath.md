# Adopt errore in Hono Feature Routers

## Context

The API uses mixed error handling: ad-hoc `{ message, status }` objects in `firebase-rest.ts`, `try-catch` with `normalizeFirebaseAuthError` + mapper functions in routes/middleware, and `throw new Error()` in `oauth.ts`/`rls.ts`. There is no `app.onError()` handler. This refactoring adopts `errore` to unify all error handling around `Error | T` returns with `instanceof Error` checks.

## Architecture

```
[Domain functions]     -> return Error | T   (never throw)
[Route handlers]       -> instanceof Error -> c.json() or c.redirect()
```

Each error class carries a `statusCode` property. Route handlers check `instanceof Error` and return JSON responses directly — no `throw`, no `app.onError()`.

```ts
// Route handler pattern
const result = await someFunction();
if (result instanceof Error) return c.json({ message: result.message }, result.statusCode);
```

## Steps

### Step 1: Create `packages/errors` shared package

New workspace package `@repo/errors`:

```
packages/errors/
  package.json    # name: "@repo/errors", private, type: module, deps: ["errore"]
  tsconfig.json   # extends "@repo/typescript-config/base.json"
  src/
    index.ts      # barrel re-export
    auth-error.ts       # AuthError (code + message)
    auth-rest-error.ts  # AuthRestError (status + message)
    oauth-errors.ts     # OAuthConfigError, OAuthStateError, OAuthExchangeError
    rls-error.ts        # RlsError
```

- `errore` is a dependency of `packages/errors` only
- `apps/api` adds `@repo/errors: workspace:*` as a dependency
- `apps/web` can add it later if needed

| Class                | File                 | Key Props         | statusCode                           |
| -------------------- | -------------------- | ----------------- | ------------------------------------ |
| `AuthError`          | `auth-error.ts`      | `code: string`    | 401 (default)                        |
| `AuthRestError`      | `auth-rest-error.ts` | `status: string?` | varies (400/401/403/409/429/502/503) |
| `OAuthConfigError`   | `oauth-errors.ts`    | —                 | 500                                  |
| `OAuthStateError`    | `oauth-errors.ts`    | —                 | 400                                  |
| `OAuthExchangeError` | `oauth-errors.ts`    | —                 | 502                                  |
| `RlsError`           | `rls-error.ts`       | —                 | 500                                  |

All use `createTaggedError`. Each has a `statusCode` property so route handlers can do `c.json({ message: e.message }, e.statusCode)`. Barrel export from `index.ts`.

### Step 2: Add `@repo/errors` to `apps/api`

Add `"@repo/errors": "workspace:*"` to `apps/api/package.json` dependencies. Run `bun install`.

### Step 3: No `app.onError()` needed

Route handlers handle errors directly via `instanceof Error`. No centralized error handler.

### Step 4: Refactor `apps/api/src/shared/firebase-auth-error.ts`

- Remove `AuthError` class (moved to `@repo/errors`)
- Remove `AuthErrorLike` type
- `normalizeFirebaseAuthError()` always returns `AuthError` (wraps `FirebaseAuthError` as `cause`), sets `statusCode` based on error code:
  - `internal-error` → 503
  - `user-disabled` → 403
  - `invalid-session-cookie-duration` → 500
  - default → 401
- Remove all 3 mapper functions (`getRequireAuthFailure`, `getSessionCookieIssuanceFailure`, `getServerSignOutFailure`) — no longer needed since `AuthError.statusCode` carries the status
- Keep `shouldClearSessionCookieForAuthError()` accepting `AuthError`
- Keep `toAuthCode()` and `FIREBASE_ERROR_CODES` as-is

### Step 5: Update `apps/api/src/shared/types/hono.d.ts`

`authSessionError: AuthErrorLike | null` → `authSessionError: AuthError | null`

### Step 6: Refactor `apps/api/src/shared/firebase-rest.ts`

- Replace `createAuthFailure()` with `new AuthRestError({ message, status, cause })`
- Replace `try { fetch() } catch {}` with `.catch((e) => new AuthRestError({ ..., cause: e }))`
- Return type: `Promise<AuthRestError | FirebaseEmailPasswordAuthResponse>`

### Step 7: Refactor `apps/api/src/shared/oauth.ts`

All functions return error values instead of throwing:

| Function                            | Return Type                                            |
| ----------------------------------- | ------------------------------------------------------ |
| `getOAuthStateSecret`               | `OAuthConfigError \| Uint8Array`                       |
| `createOAuthAuthorizationUrl`       | `OAuthConfigError \| string`                           |
| `consumeOAuthState`                 | `OAuthStateError \| OAuthConfigError \| { returnTo? }` |
| `exchangeGoogleAuthorizationCode`   | `OAuthConfigError \| OAuthExchangeError \| string`     |
| `exchangeAppleAuthorizationCode`    | `OAuthConfigError \| OAuthExchangeError \| string`     |
| `exchangeProviderAuthorizationCode` | `OAuthConfigError \| OAuthExchangeError \| string`     |

- `consumeOAuthState`: move `clearOAuthState()` to top (remove `try-finally`)
- `fetch()` calls: add `.catch((e) => new OAuthExchangeError({ ..., cause: e }))`

### Step 8: Refactor `apps/api/src/shared/middleware/auth.middleware.ts`

- `verifySessionCookie`: `.catch()` → `AuthError`, check `instanceof Error`
- `requireAuth()`: `return c.json({ message: authSessionError.message }, authSessionError.statusCode)` instead of calling mapper function

### Step 9: Refactor `apps/api/src/shared/db/rls.ts`

- Replace `throw` with `return new RlsError({ ... })`
- `tx.execute(sql.raw(...))`: add `.catch((e) => new RlsError({ ..., cause: e }))`
- Return type: `Promise<RlsError | T>`

### Step 10: Refactor `apps/api/src/features/auth/route.ts`

All handlers check `instanceof Error` and return responses directly — no `throw`.

**Credential handlers** (JSON response):

- `signInHandler`/`signUpHandler`: `if (result instanceof Error) return c.json({ message: result.message }, result.statusCode)` (replaces `"status" in result`)
- `issueSessionCookie`: `.catch()` → returns `AuthError | void`
- `finishCredentialAuth`: `if (sessionResult instanceof Error) return c.json({ message: sessionResult.message }, sessionResult.statusCode)`
- `finishOAuthBrowserAuth`: `if (sessionResult instanceof Error) return c.redirect(buildOAuthFailureRedirect(c, sessionResult.message, returnTo), 302)`
- `userHandler`: `if (rlsResult instanceof Error) return c.json({ message: rlsResult.message }, rlsResult.statusCode)`
- `signOutHandler`: `.catch()` on `revokeRefreshTokens`, check `shouldClearSessionCookieForAuthError` for conditional cookie clear

**OAuth handlers** (redirect):

- `oauthStartHandler`: `if (url instanceof Error) return c.redirect(buildOAuthFailureRedirect(c, url.message), 302)`
- `oauthCallbackHandler`: `if (result instanceof Error) return c.redirect(...)` for all error checks

### No changes to `apps/api/src/features/countries/route.ts`

## Files Modified

| File                                                | Action                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/errors/package.json`                      | **New** — `@repo/errors`, dep: `errore`                                   |
| `packages/errors/tsconfig.json`                     | **New** — extends base config                                             |
| `packages/errors/src/*.ts`                          | **New** — 5 error definition files + barrel                               |
| `apps/api/package.json`                             | Add `@repo/errors: workspace:*` dependency                                |
| `apps/api/src/shared/firebase-auth-error.ts`        | Remove class/type/mappers, `normalizeFirebaseAuthError` sets `statusCode` |
| `apps/api/src/shared/firebase-rest.ts`              | `AuthRestError` replaces `createAuthFailure`                              |
| `apps/api/src/shared/oauth.ts`                      | 12 throws → return-value errors                                           |
| `apps/api/src/shared/middleware/auth.middleware.ts` | `.catch()` + `c.json()` in `requireAuth`                                  |
| `apps/api/src/shared/db/rls.ts`                     | `RlsError` replaces `throw`                                               |
| `apps/api/src/shared/types/hono.d.ts`               | `AuthErrorLike` → `AuthError`                                             |
| `apps/api/src/features/auth/route.ts`               | `instanceof Error` + `c.json()`/`c.redirect()`                            |

## Verification

1. `bun run check-types` — type-check all workspaces
2. `bun run build` — build both apps
3. Manual test: sign-in, sign-up, OAuth flows, sign-out, user endpoint
