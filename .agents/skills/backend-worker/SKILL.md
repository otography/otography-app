---
name: backend-worker
description: Implements API features with TDD using vitest + @cloudflare/vitest-pool-workers
---

# Backend Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

API feature implementation in `apps/api/src/`. This includes:
- New route handlers (Hono)
- Shared utilities (auth, Firebase, middleware)
- Database operations (Drizzle ORM)
- Unit/integration tests for API code

## Required Skills

- `errore` — For understanding the error handling convention (return Error objects, not throw). Invoke before writing error handling code.

## Work Procedure

1. **Read context files first:**
   - Read `mission.md` and `AGENTS.md` for mission boundaries and conventions
   - Read the feature description in `features.json` for the assigned feature
   - Read `.factory/library/architecture.md` for system understanding
   - Read `.factory/library/environment.md` for env var details

2. **Understand existing patterns:**
   - Read the relevant existing files in the same area (e.g., `apps/api/src/features/auth/route.ts` for auth features)
   - Read existing tests in `apps/api/src/__tests__/` to match test patterns
   - Read `apps/api/src/__tests__/setup.ts` for mock setup patterns
   - Read `apps/api/src/__tests__/helpers/test-client.ts` for `testRequest()` helper

3. **Write tests FIRST (TDD):**
   - Create test file at `apps/api/src/__tests__/features/auth/<feature>.test.ts`
   - Use `describe/it` structure matching existing tests
   - Use `vi.mock()` at module boundaries (Firebase, Google, database)
   - Use `vi.hoisted()` for mock functions referenced in both mocks and tests
   - Use `vi.clearAllMocks()` in `beforeEach`
   - Write failing tests first — cover success, error, and edge cases
   - Use `testRequest()` helper for route handler tests
   - Assertions: use `toMatchObject` over `toEqual` for large objects

4. **Implement to make tests pass:**
   - Follow errore pattern: return Error objects, don't throw
   - Use arktype for runtime validation, not Zod
   - Use existing infrastructure (session-cookie, refresh-token, firebase-admin modules)
   - Source code comments in Japanese
   - Import types with `import { type X }` syntax

5. **Run verification:**
   - `bun run test --filter=api -- <test-file>` — all tests must pass
   - `bun run check-types --filter=api` — no type errors
   - `bun run lint --filter=api` — no lint errors

6. **Manual sanity check:**
   - Start dev server with `cd apps/api && bun run dev`
   - Test the new endpoint with curl if applicable
   - Verify no regressions in existing endpoints

## Example Handoff

```json
{
  "salientSummary": "Implemented OAuth state JWT utility with jose HMAC-SHA256 signing and verification. Added 6 unit tests covering valid/invalid/expired/tampered states. All tests pass, types check clean.",
  "whatWasImplemented": "Created apps/api/src/shared/auth/oauth-state.ts with generateOAuthState() and verifyOAuthState() functions. Uses AUTH_OAUTH_STATE_SECRET for HS256 signing. State payload includes nonce, iat, exp (5min), redirect. Created tests at apps/api/src/__tests__/features/auth/oauth-state.test.ts with 6 test cases.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "bun run test --filter=api -- src/__tests__/features/auth/oauth-state.test.ts", "exitCode": 0, "observation": "6 tests passed" },
      { "command": "bun run check-types --filter=api", "exitCode": 0, "observation": "No type errors" },
      { "command": "bun run lint --filter=api", "exitCode": 0, "observation": "No lint errors" }
    ],
    "interactiveChecks": []
  },
  "tests": {
    "added": [
      {
        "file": "apps/api/src/__tests__/features/auth/oauth-state.test.ts",
        "cases": [
          { "name": "generates valid JWT with correct claims", "verifies": "VAL-API-002" },
          { "name": "verifies valid state JWT", "verifies": "VAL-API-002" },
          { "name": "rejects expired state JWT", "verifies": "VAL-API-003" },
          { "name": "rejects tampered state JWT", "verifies": "VAL-API-002" },
          { "name": "includes custom redirect claim", "verifies": "VAL-API-004" },
          { "name": "defaults redirect to /account", "verifies": "VAL-API-004" }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Feature depends on env vars not yet configured in `.dev.vars` or `wrangler.jsonc`
- Feature depends on Firebase Console or Google Cloud Console configuration changes
- Existing bugs in unrelated features block implementation
- Requirements are ambiguous after reading all context files
