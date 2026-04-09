# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
bun install

# Development (both apps)
bun run dev

# Development (single app)
bun run dev --filter=web
bun run dev --filter=api

# Build
bun run build

# Testing
bun run test                    # all tests
bun run test --filter=api      # API tests only
bun run test --filter=web      # web tests only
bun run test --filter=api -- src/__tests__/features/auth/sign-in.test.ts  # single test file

# Type checking
bun run check-types

# Linting & formatting (oxlint + oxfmt)
bun run lint
bun run lint:fix
bun run format
bun run format:fix

# Dead code detection (knip)
bun run check-dead-code

# All quality checks
bun run quality

# Database (run from apps/api)
cd apps/api && bun run db:generate   # generate Drizzle migrations
cd apps/api && bun run db:migrate    # run migrations
cd apps/api && bun run db:push       # push schema directly (dev)
cd apps/api && bun run db:studio     # open Drizzle Studio
```

## Architecture

**Turborepo monorepo** with Bun as the package manager.

- `apps/web` — Next.js 16 (App Router) + React 19 with React Compiler enabled. Runs on port 3000.
- `apps/api` — Hono API server on Bun runtime. Runs on port 3001.
- `packages/errors` — Shared error classes (errore-based, `createTaggedError`).
- `packages/eslint-config` — Shared ESLint configs (legacy, oxlint is primary).
- `packages/typescript-config` — Shared tsconfig bases (`base.json`, `nextjs.json`, `react-library.json`).

### Type-Safe RPC (Hono RPC)

The API exports `AppType` from `apps/api/src/index.ts`. The web app imports it via path alias (`api`) and creates a type-safe client with `hc<AppType>()` in `apps/web/src/lib/api.ts`. Use this client for all API calls from client components. Server components use direct `fetch` with forwarded cookies via `getCurrentUser()` in `apps/web/src/lib/current-user.ts`.

### Authentication

Firebase Authentication with session cookies (`otography_session`, 5-day expiry). The API uses Firebase Admin SDK; client-facing auth operations use the Firebase REST API. OAuth (Google, Apple) via Firebase Identity Platform with `jose` for OAuth state JWT signing.

Next.js middleware (`apps/web/proxy.ts`) guards authenticated routes — unauthenticated users are redirected to `/login`.

### Database

PostgreSQL with Drizzle ORM and `postgres.js` driver. Row-Level Security (RLS) is enforced on all tables via a `requesting_user_id()` PostgreSQL function. The `withRls()` helper in `apps/api/src/shared/db/rls.ts` wraps transactions that set JWT claims and switch to the `authenticated` role. Prepared statements are disabled (`prepare: false`) due to Supabase Transaction pool mode.

Database connection uses a `globalThis` singleton pattern to avoid connection pool exhaustion in development.

### Error Handling

Uses the **errore** convention: functions return error objects instead of throwing. Callers check `instanceof Error` and TypeScript narrows the type. Errors carry `statusCode` (Hono `ContentfulStatusCode`) and optional `clearCookie` flag. See `.claude/skills/errore/` for the full pattern guide.

### Testing

Test behavior, not implementation. Mock only at boundaries (Firebase, database, third-party APIs), not internal modules. Prefer fewer, higher-impact tests — every test must be able to fail for a real defect. Failure messages must be actionable (`toMatchObject` over `toEqual` for large objects). See `.claude/skills/agentic-testing/SKILL.md` for the full guidelines.

### Validation

Arktype (`arktype`) for all runtime type validation — env vars, request bodies, and DB insert schemas. Do not use Zod.

### UI & Component Architecture

Compound component pattern with React Context and `use()` (React 19 API). Prefer composition over boolean props — use explicit variant components instead of `mode` or `variant` props. Use `children` for composition rather than render props. Do not use `forwardRef` (React 19). See `.claude/skills/vercel-composition-patterns/AGENTS.md` for the full guidelines.

## Code Style

- **Formatter:** oxfmt — 100 char width, spaces (width 2), semicolons, double quotes, trailing commas
- **Linter:** oxlint (replaces ESLint) — type-aware linting available via `--type-aware` flag
- **Git hooks:** Lefthook runs oxfmt and oxlint --fix on staged files at pre-commit
- Source code comments are in Japanese

## Environment

Environment variables are managed with `@t3-oss/env-core` (API) and `@t3-oss/env-nextjs` (web) for type-safe access. Encrypted env files use dotenvx (`.env.x`). Drizzle has a separate `env.drizzle.ts` that only requires `DATABASE_URL`, so migration commands don't need all app env vars.
