# Opaque Server-Side Session System — Test List

## Architecture Overview

Replace browser-held Firebase session/refresh cookies with BFF-style opaque server sessions.
Browser receives only a random opaque session ID cookie; all Firebase credentials live
encrypted in PostgreSQL.

## Product Policy: Session Lifetimes

- **Idle timeout**: 5 days since last use. Each verified request extends idle expiry.
  This is a product decision, independent of Firebase's session cookie lifetime.
- **Absolute timeout**: 14 days from creation. Cannot be extended.
  This bounds replay risk; idle extension never bypasses absolute expiry.
- Firebase refresh tokens have variable lifetimes and must not be conflated with
  session lifetime. The DB session is the authoritative source of validity.

## Cookie Syntax

- Opaque session IDs are exactly 32 bytes of CSPRNG entropy encoded as unpadded
  base64url, producing a fixed 43-character string matching `[A-Za-z0-9_-]{43}`.
- Cookie values that do not match this exact pattern are rejected before any DB query.

## Key Management

- Single JSON key-ring secret binding `AUTH_SESSION_KEY_RING` (SecretsStoreSecret | string).
- JSON shape: `{ v: 1, activeKeyId: string, keys: [{ id, hex, decryptOnly? }] }`.
- Strict validation: no duplicate IDs, active key must not be decrypt-only,
  all keys must be exactly 32 bytes (64 hex chars), unknown top-level fields rejected.
- CryptoKeys cached by key ID fingerprint; binding value re-fetched each call so
  Secrets Store rotation becomes visible without redeploy.

## Test List (behavioral, not implementation)

### Phase 1: DB Schema + Migration

- [x] server_sessions table exists with correct columns
- [ ] server_sessions FK user_id -> users.id ON DELETE CASCADE exists
- [ ] key_version column is NOT NULL
- [ ] redundant non-unique hash index removed (unique constraint suffices)
- [ ] encrypted credential columns use jsonb (not text/JSON string)
- [ ] anon role cannot SELECT from server_sessions (SET LOCAL ROLE anon)
- [ ] authenticated role cannot SELECT from server_sessions (SET LOCAL ROLE authenticated)
- [ ] deleting a user cascades to delete their server_sessions
- [ ] key_version rejects NULL insert
- [ ] session_hash unique constraint is enforced

### Phase 2: Crypto Utilities

- [x] generateOpaqueSessionId: produces base64url 43-char string (32 bytes entropy)
- [x] generateOpaqueSessionId: each call produces unique values
- [x] hashSessionId: produces deterministic SHA-256 hex from raw id
- [x] hashSessionId: different inputs produce different hashes
- [ ] validateOpaqueCookieValue: accepts valid 43-char base64url
- [ ] validateOpaqueCookieValue: rejects too-short, too-long, non-base64url, empty
- [ ] key-ring validation: rejects empty/missing active key id
- [ ] key-ring validation: rejects duplicate key ids
- [ ] key-ring validation: rejects malformed (non-32-byte) keys
- [ ] key-ring validation: rejects active key being decrypt-only
- [ ] key-ring validation: accepts valid config with active + decrypt-only keys
- [ ] key-ring validation: rejects unknown top-level fields
- [x] encrypt: produces valid versioned envelope (v, kid, iv, ct)
- [x] encrypt: uses 96-bit IV
- [x] encrypt: AAD binds session hash, user id, purpose, version
- [x] decrypt: round-trips ciphertext to original plaintext with correct key
- [x] decrypt: fails with wrong key id (not in key-ring)
- [x] decrypt: fails when AAD components are tampered
- [x] decrypt: fails when ciphertext is tampered
- [x] decrypt: supports retired/decrypt-only keys
- [ ] envelope validation: rejects unsupported version
- [ ] envelope validation: rejects malformed IV (not 24-hex / 12 bytes)
- [ ] envelope validation: rejects empty/odd-length ciphertext
- [ ] envelope validation: rejects malformed key id format
- [ ] envelope validation: rejects unknown fields
- [ ] decrypt: WebCrypto rejection returns tagged error with cause
- [ ] encrypt: WebCrypto rejection returns tagged error with cause
- Note: SHA-256 indexed DB lookup is used for session lookup (not constant-time app comparison).

### Phase 3: Key Ring Loader

- [ ] getEncryptCtx: parses AUTH_SESSION_KEY_RING JSON via errore.try
- [ ] getEncryptCtx: returns KeyRingError for malformed JSON
- [ ] getEncryptCtx: returns KeyRingError for invalid key-ring shape
- [ ] getEncryptCtx: caches CryptoKey by key ID, not forever on the binding value
- [ ] getEncryptCtx: never logs raw key bytes, ciphertext, or plaintext

### Phase 4: Session Repository

- [x] createServerSession: inserts a new session row, returns session
- [x] getValidSessionByOpaqueId: returns session when hash matches and not revoked
- [x] getValidSessionByOpaqueId: returns null when hash doesn't match
- [x] getValidSessionByOpaqueId: returns null when session is revoked
- [x] getValidSessionByOpaqueId: returns null when session is expired (idle)
- [x] getValidSessionByOpaqueId: returns null when session is expired (absolute)
- [x] touchSession: updates last_used_at timestamp
- [x] touchSession: throttled (skip if within threshold)
- [x] refreshSessionCredentials: atomically updates credentials with optimistic concurrency
- [x] refreshSessionCredentials: fails if version mismatch (concurrent update)
- [x] revokeSession: sets revoked_at timestamp
- [x] revokeAllUserSessions: revokes all sessions for a user
- [ ] key_version and envelope kid consistency enforced on read
- [ ] all repository .catch returns tagged DbError (not plain Error)

### Phase 5: Session Service (direct unmocked tests)

- [ ] issueSession: creates session with active key, stores encrypted credentials
- [ ] resolveSession: success path verifies credential, touches session
- [ ] resolveSession: refresh rotation on expired Firebase credential
- [ ] resolveSession: terminal decrypt failure revokes DB session + returns error with clearCookie
- [ ] resolveSession: terminal Firebase verify failure revokes DB session
- [ ] resolveSession: terminal refresh failure revokes DB session
- [ ] resolveSession: CAS loser re-reads winner, decrypts, returns valid session (both requests auth)
- [ ] resolveSession: stale credentials never overwrite CAS winner
- [ ] lazyReEncrypt: old key -> active key, CAS-safe, errors propagated
- [ ] batchReEncrypt: deterministic batch with limit/cursor
- [ ] batchReEncrypt: reports structured errors per session
- [ ] batchReEncrypt: CAS conflict handling
- [ ] countRemainingByKey: returns count of active sessions still on old key
- [ ] all service errors are tagged AuthError/domain errors (not plain SessionServiceError)

### Phase 6: Auth Middleware

- [ ] authSessionMiddleware: resolves opaque cookie to valid session, sets authSession + sessionCtx
- [ ] authSessionMiddleware: validates cookie syntax before DB lookup
- [ ] authSessionMiddleware: invalid cookie syntax clears cookie, no DB query
- [ ] authSessionMiddleware: no cookie -> authSession null, sessionCtx null, continues
- [ ] authSessionMiddleware: terminal resolve error clears cookie, sets null
- [ ] authSessionMiddleware: stores resolved session id + DB userId in context
- [ ] requireAuthMiddleware: rejects with 401 when no session
- [ ] requireFreshSessionMiddleware: single coherent strict resolve, no bypass
- [ ] requireFreshSessionMiddleware: uses sessionCtx from authSessionMiddleware

### Phase 7: Cookie Utilities

- [ ] opaque cookie uses \_\_Host- prefix in production (https)
- [ ] opaque cookie uses dev-safe name on localhost (http)
- [ ] cookie attributes: HttpOnly, Secure (prod), SameSite=Strict, Path=/, no Domain
- [ ] clearOpaqueCookie: sets expiry in past
- [ ] no backward-compat REFRESH_TOKEN_COOKIE_NAME export

### Phase 8: Sign-in / Sign-up / OAuth / Sign-out / Delete

- [x] sign-in: creates DB user, creates server session, sets only opaque cookie
- [x] sign-up: creates DB user, creates server session, sets only opaque cookie
- [x] OAuth callback: creates DB user, creates server session, sets only opaque cookie
- [ ] sign-out: revokes ONLY current server session, clears cookie (no global Firebase revoke)
- [ ] sign-out: does not call revokeRefreshTokens
- [ ] account deletion: revokes ALL server sessions for DB user (tested)
- [ ] account deletion: clears cookie
- [ ] account deletion: Firebase user/token revocation preserved at boundary

### Phase 9: Batch Re-encryption

- [ ] batchReEncrypt: re-encrypts sessions from old key to new key
- [ ] batchReEncrypt: reports count of re-encrypted sessions
- [ ] batchReEncrypt: skips already-active-key sessions
- [ ] batchReEncrypt: fails/reports on decrypt errors (no silent skip)
- [ ] batchReEncrypt: bounded batch size for Worker limits
- [ ] countRemainingByKey: rotation safe only when zero

### Phase 10: Error Convention Audit

- [ ] No catch(e => e as Error) in any session/auth code
- [ ] No catch(() => undefined) or catch(() => [null]) in session/auth code
- [ ] No unwrapped JSON.parse in session/auth code
- [ ] No plain Error creation for expected failures
- [ ] All domain errors use tagged errore errors with cause chains

## Implementation Order

1. Schema fix + migration regeneration (FK, NOT NULL, jsonb, remove redundant index)
2. Cookie syntax validation utility
3. Envelope strict validation (Arktype) + tagged crypto errors
4. Key-ring loader rewrite (AUTH_SESSION_KEY_RING JSON, errors as values)
5. Session repository error convention cleanup
6. Session service fixes (terminal revoke, CAS recovery, batch, lazy re-encrypt propagation)
7. Auth middleware (sessionCtx, cookie validation, requireFreshSession single resolve)
8. Route handler fixes (sign-out device-only, account deletion revokes all)
9. Env/bindings/test config updates
10. Direct unmocked session-service tests
11. DB integration tests (FK cascade, RLS denial via SET LOCAL ROLE)
12. Final verification
