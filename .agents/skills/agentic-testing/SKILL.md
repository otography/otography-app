---
name: agentic-testing
description: Testing best practices for agentic LLM coding (Claude Code, etc.). Use whenever writing tests, reviewing test strategy, setting up testing infrastructure, or when the user mentions tests, testing, TDD, test coverage, regression protection, CI testing, vitest, jest, or asks "what should I test?". Also use when adding new features or refactoring — tests should be part of the workflow, not an afterthought.
user-invocable: false
---

# Agentic Testing: Tests for the Age of LLM Coding

Tests written for agentic coding serve a fundamentally different purpose than traditional tests. They are the **feedback loop** that an LLM agent uses to verify its own changes. The agent writes code, runs tests, reads failures, and iterates. This means test quality directly determines coding quality.

## Core Principle

**Test behavior, not implementation.** An agent can refactor internals freely if tests verify outcomes, not internal mechanics. Tests coupled to implementation details (mock call arguments, internal function signatures) create noisy failures that waste agent context and slow iteration.

## The Agent Testing Hierarchy

Adapted from the traditional testing pyramid for non-deterministic AI systems (Block Engineering).

### Layer 1: Deterministic Foundations (most tests)

Pure logic, no LLM, no I/O. These tests are fast, deterministic, and catch real bugs.

**What to test:**
- Pure functions (validation, transformation, mapping logic)
- Business rules and domain invariants
- Error code mapping (e.g., `FirebaseAuthError.code` → HTTP status)
- Route guards (cookie presence → redirect/allow)
- Configuration parsing

**What NOT to test:**
- External library internals (if the library has its own tests)
- Framework-guaranteed behavior (Hono/Zod validation, React rendering)
- Type checker guarantees (TypeScript `tsc --noEmit` catches these)

**Pattern:** Use real objects over mocks when possible. `NextRequest`/`NextResponse` can be instantiated directly — no need to mock `next/server`.

### Layer 2: Contract Tests (integration boundaries)

Verify the contract between system boundaries (API ↔ client, service ↔ service).

**What to test:**
- HTTP status codes for each endpoint
- Response shape/schema (field names, types)
- Cookie names, headers, and auth flow
- Error response format and messages
- Redirect targets and status codes

**Pattern:** Exercise the real middleware chain. Mock only external dependencies (Firebase, database, third-party APIs), not internal modules.

### Layer 3: Behavior Tests (UI and user-facing)

Verify what the user experiences, not what functions are called.

**What to test:**
- Navigation: "After successful action, user lands on `/account`"
- Error display: "When API returns 401, error message is shown"
- Pending states: "Button shows 'Loading...' and is disabled while fetching"
- Accessible links: "OAuth link points to correct API endpoint"

**What NOT to test:**
- Mock call arguments (`expect(mockFn).toHaveBeenCalledWith(...)`)
- HTML attributes the browser validates (`type="email"`, `required`)
- CSS inline styles (unless they encode behavior like `pointerEvents: "none"`)

## Rules

### R1: Every test must be able to fail for a real defect

If a test would pass even if the application logic were wrong, it has no value. Ask: "What bug would this test catch that no other test catches?"

**Bad:** Testing that `createTaggedError()` adds `_tag` property (library behavior).
**Good:** Testing that `auth/user-disabled` maps to 403 + clearCookie (application logic).

### R2: Prefer fewer, higher-impact tests

50 tests that each catch unique defects beat 200 tests where 150 test framework behavior. Agent iteration is faster with a smaller, more focused suite.

### R3: Tests must be deterministic and fast

Flaky tests destroy agent confidence. If a test sometimes passes and sometimes fails, the agent wastes context investigating non-existent bugs. All tests must pass consistently in under 5 seconds total.

### R4: Failure messages must be actionable

When a test fails, the agent needs to understand what went wrong from the output alone. `expect(status).toBe(200)` is good. `expect(result).toEqual(massiveObject)` is bad — use `toMatchObject` for partial matching.

### R5: Mock at boundaries, not between internal modules

Mock external services (Firebase, Stripe, database). Do NOT mock internal modules (`@/lib/api`, `@/env`) unless they have import-time side effects (e.g., `@t3-oss/env-nextjs` reading `process.env`).

**Why:** Mocking internal modules couples tests to implementation. When the agent refactors module boundaries, all tests break — even though behavior is unchanged.

### R6: No test without a corresponding production bug it could catch

Before writing a test, identify the specific defect it would detect. If you can't name one, the test is noise.

## TDD Workflow for Agentic Coding

When adding a new feature, follow this sequence:

1. **Write tests first** based on expected behavior (input/output pairs, status codes, navigation outcomes)
2. **Confirm tests fail** — tell the agent not to write implementation yet
3. **Implement until tests pass** — agent writes code, runs tests, iterates
4. **Verify with independent subagents** — check implementation isn't overfitting to tests
5. **Commit tests and implementation separately**

This is from Anthropic's official Claude Code best practices. It works because it gives the agent a clear, measurable target to iterate against.

## Testing Checklist

When writing or reviewing tests:

- [ ] Does this test catch a defect that no other test catches? (R1)
- [ ] Is the test deterministic? No random values, no time dependencies, no flaky I/O (R3)
- [ ] Does the failure message tell the agent what went wrong? (R4)
- [ ] Are we testing behavior (outcomes), not implementation (internals)? (Core Principle)
- [ ] Could an agent refactor the code under test without breaking this test? (R2, R5)
- [ ] Is this testing something the type checker or framework already validates? (Layer 1 exclusion)
