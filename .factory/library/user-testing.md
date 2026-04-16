# User Testing

Testing surface, required tools, and resource classification for validation.

**What belongs here:** Validation surface findings, required testing skills/tools, resource cost classification.

---

## Validation Surface

### Surface 1: API Endpoints (curl / HTTP)

**Endpoints under test:**

- `GET /api/auth/google` — OAuth redirect
- `GET /api/auth/google/callback` — OAuth callback

**Tool:** `curl` or `testRequest()` in vitest

**Setup:** API server running on port 3001. No database needed for OAuth tests (Firebase handles user management). Env vars configured.

**Testable without real Google credentials:** Yes — mock Google and Firebase endpoints in unit tests.

### Surface 2: Web Browser (agent-browser)

**Pages under test:**

- `/login` — Google sign-in button, error display
- `/signup` — Google sign-in button
- `/setup-profile` — Post-OAuth redirect target (new users)
- `/account` — Post-OAuth redirect target (existing users)

**Tool:** `agent-browser`

**Setup:** Both API (port 3001) and Web (port 3000) dev servers running. PostgreSQL on 54322.

**Testable without real Google credentials:** Partially — can verify button presence, href, error display. Cannot verify full OAuth roundtrip without real Google credentials.

### Limitations

- Full OAuth roundtrip (Google consent → callback → session) requires manual testing with real Google credentials
- `needConfirmation` scenario requires a Google account whose email matches an existing password user
- agent-browser cannot automate Google's consent screen

## Validation Concurrency

**Machine:** 8GB RAM, 8 CPU cores

**agent-browser:** Each instance ~300MB. Dev servers ~200MB. Usable headroom: ~4GB \* 0.7 = ~2.8GB.

- 5 concurrent validators: 5 \* 300MB + 200MB = 1.7GB (fits within budget)
- **Max concurrent agent-browser validators: 5**

**curl/API tests:** Negligible resource consumption. No concurrency limit concern.
