# Refactor to errore (Go-style error handling for TypeScript)

## Context

The codebase currently mixes exception-based (`throw`/`try-catch`) and ad-hoc return-based (`{ message, status }` objects) error handling. This refactoring adopts the `errore` library to unify all error handling around the "errors as values" pattern: functions return `Error | T` unions, callers check `instanceof Error` for early returns, and `.catch()` is used only at async boundaries with third-party code.

Error type definitions are extracted into a new `packages/errors` shared package so both `apps/api` and `apps/web` can import them.

## Architecture: Two-Layer Error Handling

```
[Domain functions]        → return Error | T  (never throw)
[Route handlers]          → throw Error      (Hono framework boundary)
[app.onError()]           → matchError → JSON response  (centralized)
[OAuth handlers only]     → instanceof Error → redirect  (browser redirect requires it)
```

- **Domain functions** (`signInWithPassword`, `exchangeProviderAuthorizationCode`, etc.): return `Error | T`, never throw
- **Route handlers** (credential, user, sign-out): `if (result instanceof Error) throw result` — Hono is the framework boundary
- **`app.onError()`**: centralized `matchError` converts all errors to JSON responses
- **OAuth handlers** (`oauthStartHandler`, `oauthCallbackHandler`): browser redirect flow requires `redirect()` not JSON, so these handle `instanceof Error → redirect` inline

## Scope

**In:** `packages/errors` (new), `apps/api` (backend), `apps/web/src/lib/current-user.ts` (server-side)
**Out:** React client components (`login-form.tsx`, `sign-out-button.tsx`) — try-catch with `useState` is idiomatic React

## New Package: `packages/errors`

```
packages/errors/
  package.json          # name: "@repo/errors", deps: ["errore"]
  tsconfig.json         # extends @repo/typescript-config/base.json
  src/
    index.ts            # re-exports all error classes
    auth-error.ts       # AuthError (code + description)
    auth-rest-error.ts  # AuthRestError (status + code + description)
    oauth-errors.ts     # OAuthConfigError, OAuthStateError, OAuthExchangeError
    database-error.ts   # RlsError
    current-user-error.ts # CurrentUserError
```

Add `@repo/errors` as workspace dependency in `apps/api` and `apps/web`. Install `errore` in `packages/errors` only.

## Tagged Errors

| Error Class          | Package File            | Props                                             | Used By                   |
| -------------------- | ----------------------- | ------------------------------------------------- | ------------------------- |
| `AuthError`          | `auth-error.ts`         | `code: string`, `$description`                    | Middleware, onError       |
| `AuthRestError`      | `auth-rest-error.ts`    | `status: number`, `code?: string`, `$description` | firebase-rest.ts, onError |
| `OAuthConfigError`   | `oauth-errors.ts`       | `$description`                                    | oauth.ts, OAuth handlers  |
| `OAuthStateError`    | `oauth-errors.ts`       | `$description`                                    | oauth.ts, OAuth handlers  |
| `OAuthExchangeError` | `oauth-errors.ts`       | `$description`                                    | oauth.ts, OAuth handlers  |
| `RlsError`           | `database-error.ts`     | `$description`                                    | rls.ts, onError           |
| `CurrentUserError`   | `current-user-error.ts` | `$description`                                    | current-user.ts           |

All use `createTaggedError` with `message: "$description"`, giving `_tag`, `message`, `cause`, `findCause()`.

## Implementation Steps

### Step 1: Create `packages/errors`

- `package.json`: name `@repo/errors`, dependency `errore`, export `./src/index.ts`
- `tsconfig.json`: extends base config
- Define all 7 tagged error classes
- `AuthError` has a manual `code: string` property + `$description` template

### Step 2: Add `app.onError()` in `apps/api/src/index.ts`

Centralized error-to-JSON-response mapping:

```ts
import * as errore from "errore";
import { AuthError, AuthRestError, RlsError } from "@repo/errors";
import { getAuthFailure } from "./shared/firebase-auth-error";

app.onError((err, c) => {
	if (errore.isAbortError(err)) return c.json({ message: "Request cancelled." }, 499);

	return errore.matchError(err, {
		AuthRestError: (e) =>
			c.json({ message: e.message }, e.status as 400 | 401 | 403 | 409 | 429 | 502 | 503),
		AuthError: (e) => {
			const failure = getAuthFailure(e);
			return c.json(failure.body, failure.status);
		},
		RlsError: (e) => c.json({ message: e.message }, 500),
		Error: () => c.json({ message: "Internal server error." }, 500),
	});
});
```

### Step 3: `apps/api/src/shared/firebase-auth-error.ts`

- Import `AuthError` from `@repo/errors`
- `normalizeFirebaseAuthError` always returns `AuthError` (not `AuthErrorLike` union) — `FirebaseAuthError` preserved as `cause`
- Remove `AuthErrorLike` type, remove `AuthError` class definition
- Replace `hasCode()` with direct `error.code === "..."` checks
- Consolidate mapper functions into single `getAuthFailure(error: AuthError)` using `matchError`

### Step 4: `apps/api/src/shared/types/hono.d.ts`

- `authSessionError: AuthErrorLike | null` → `authSessionError: AuthError | null`

### Step 5: `apps/api/src/shared/firebase-rest.ts`

- Import `AuthRestError` from `@repo/errors`
- Replace `createAuthFailure()` with `new AuthRestError({ status, code, description })`
- Replace `try { fetch() } catch {}` with `fetch().catch(() => new AuthRestError({...}))`
- Return type: `Promise<AuthRestError | FirebaseEmailPasswordAuthResponse>`

### Step 6: `apps/api/src/shared/oauth.ts`

- Import OAuth errors from `@repo/errors`
- Replace all `throw new Error(...)` with return-value errors
- `getOAuthStateSecret` → returns `OAuthConfigError | Uint8Array`
- `createOAuthAuthorizationUrl` → returns `OAuthConfigError | string`
- `consumeOAuthState` → returns `OAuthStateError | OAuthConfigError | { returnTo?: string }`; move `clearOAuthState` to top (no try-finally)
- `exchangeGoogleAuthorizationCode` / `exchangeAppleAuthorizationCode` → `.catch()` at fetch, return `OAuthExchangeError`
- `exchangeProviderAuthorizationCode` → returns `OAuthConfigError | OAuthExchangeError | string`

### Step 7: `apps/api/src/shared/middleware/auth.middleware.ts`

- Replace `try-catch` around `verifySessionCookie` with `.catch()`
- Check `claims instanceof Error` for error path
- Store normalized `AuthError` in context

### Step 8: `apps/api/src/shared/db/rls.ts`

- Import `RlsError` from `@repo/errors`
- Replace `throw` with `return new RlsError({...})`
- Replace `try-catch` for role switch with `.catch()`
- Return type: `Promise<RlsError | T>`

### Step 9: `apps/api/src/features/auth/route.ts`

**Credential handlers** (signIn, signUp, user, signOut) — throw to `onError`:

- `signInHandler` / `signUpHandler`: `if (result instanceof Error) throw result`
- `issueSessionCookie`: `.catch()` → returns `AuthError | void`; caller throws if Error
- `finishCredentialAuth` / `finishOAuthBrowserAuth`: `if (error instanceof Error) throw error`
- `signOutHandler`: `.catch()` on `revokeRefreshTokens`; `if (revokeError instanceof Error) throw revokeError`
- `userHandler`: `if (rlsResult instanceof Error) throw rlsResult`

**OAuth handlers** — handle errors inline (redirect required):

- `oauthStartHandler`: `if (url instanceof Error) return c.redirect(buildOAuthFailureRedirect(c, url.message), 302)`
- `oauthCallbackHandler`: same pattern for all error checks

### Step 10: `apps/web/src/lib/current-user.ts`

- Import `CurrentUserError` from `@repo/errors`
- Replace `throw` with return-value errors
- `.catch()` at fetch boundary
- Return type: `Promise<CurrentUserError | CurrentUserResponse | null>`
- Update `login/page.tsx`: add `if (currentUser instanceof Error)` check

## Key Patterns

1. `import * as errore from 'errore'` — namespace import
2. `.catch((e) => new TaggedError({ cause: e }))` — at async boundaries only
3. `instanceof Error` + `throw` — at Hono framework boundary (route handlers)
4. `app.onError()` + `matchError` — centralized error → JSON response
5. OAuth handlers: `instanceof Error` → redirect (browser redirect flow exception)
6. No `try-catch` for control flow in domain code

## Verification

1. `bun run check-types` — type-check all workspaces
2. `bun run build` — build both apps
3. Manual test: sign-in, sign-up, OAuth flows, sign-out, user endpoint
