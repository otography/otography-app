---
name: frontend-worker
description: Implements Web UI features with TDD using vitest + testing-library + agent-browser verification
---

# Frontend Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Web UI feature implementation in `apps/web/src/`. This includes:
- React components (compound component pattern)
- Page-level changes (Next.js App Router)
- Client-side auth/context changes
- Component tests and browser verification

## Required Skills

- `agent-browser` — For E2E browser verification of UI changes. Invoke after all unit tests pass to verify the actual rendered UI.
- `vercel-composition-patterns` — For React component architecture patterns. Reference for compound component design.

## Work Procedure

1. **Read context files first:**
   - Read `mission.md` and `AGENTS.md` for mission boundaries and conventions
   - Read the feature description in `features.json` for the assigned feature
   - Read `.factory/library/architecture.md` for system understanding

2. **Understand existing patterns:**
   - Read existing components in the same area (e.g., `apps/web/src/features/auth/components/`)
   - Read existing tests (e.g., `apps/web/src/features/auth/components/auth.test.tsx`)
   - Note the compound component pattern used throughout the app
   - Note the `vi.hoisted()` + `vi.mock()` pattern for mocking API client and router
   - Note the `mockOkResponse()` / `mockErrorResponse()` helper pattern

3. **Write tests FIRST (TDD):**
   - Create test file at `apps/web/src/features/auth/components/<component>.test.tsx`
   - Use `vi.hoisted()` for mock functions that need to be referenced in both `vi.mock()` and test bodies
   - Mock `next/navigation` for `useRouter` and `useSearchParams`
   - Mock `@/features/lib/api` for API client calls
   - Mock `@/env` for env vars
   - Use `userEvent.setup()` for realistic user interaction
   - Use `waitFor()` for async assertions
   - Use `screen.getByRole()`, `screen.getByLabelText()` for element queries
   - Cover: rendering, user interaction, error display, navigation

4. **Implement to make tests pass:**
   - Follow compound component pattern with React Context
   - Use `"use client"` directive for client components
   - Use existing auth infrastructure (don't add Firebase/Google SDK)
   - Source code comments in Japanese
   - Match existing component style (inline styles, formisch for forms)

5. **Run verification:**
   - `bun run test --filter=web -- <test-file>` — all tests must pass
   - `bun run check-types --filter=web` — no type errors
   - `bun run lint --filter=web` — no lint errors

6. **Browser verification with agent-browser:**
   - Start both API and Web dev servers
   - Use `agent-browser` to:
     - Navigate to `/login` and verify Google sign-in button is visible
     - Navigate to `/signup` and verify Google sign-in button is visible
     - Check button href attribute points to `/api/auth/google`
     - Navigate to `/login?error=account_exists` and verify error message
     - Navigate to `/login?error=oauth_failed` and verify error message
   - Take screenshots as evidence

## Example Handoff

```json
{
  "salientSummary": "Implemented Google sign-in button component and added it to login and signup pages. Added OAuth error display with Japanese messages for 5 error types. All component tests pass. Browser verification confirms button is visible on both pages with correct href.",
  "whatWasImplemented": "Created apps/web/src/features/auth/components/google-sign-in-button.tsx (simple anchor element with href=/api/auth/google). Added component to login page (apps/web/src/app/(public)/login/page.tsx) and signup page. Added error mapping for OAuth error codes in auth context. Created tests with 4 test cases covering rendering and error display.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "bun run test --filter=web -- src/features/auth/components/google-sign-in-button.test.tsx", "exitCode": 0, "observation": "4 tests passed" },
      { "command": "bun run check-types --filter=web", "exitCode": 0, "observation": "No type errors" },
      { "command": "bun run lint --filter=web", "exitCode": 0, "observation": "No lint errors" }
    ],
    "interactiveChecks": [
      { "action": "Navigated to /login, verified 'Sign in with Google' button visible with href=/api/auth/google", "observed": "Button present and clickable" },
      { "action": "Navigated to /signup, verified Google button present", "observed": "Button present on signup page" },
      { "action": "Navigated to /login?error=account_exists, verified error message", "observed": "Error message displayed in Japanese" }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "apps/web/src/features/auth/components/google-sign-in-button.test.tsx",
        "cases": [
          { "name": "renders Google sign-in button with correct href", "verifies": "VAL-WEB-001" },
          { "name": "displays error for account_exists", "verifies": "VAL-WEB-004" },
          { "name": "displays error for oauth_failed", "verifies": "VAL-WEB-004" },
          { "name": "button uses plain anchor, no client SDK", "verifies": "VAL-WEB-003" }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- API endpoints needed by the UI are not yet implemented
- Page structure has changed significantly and needs design decisions
- Existing auth context/provider needs modification that could break existing features
