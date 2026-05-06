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

# Database integration tests (resets test DB, applies migrations, verifies schema/RLS)
bun run test:db --filter=api

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
- `packages/errors` — Shared error classes (errore-based, `createTaggedError`). Has a `./server` subpath export for server-only errors.
- `packages/firebase-auth-rest` — Firebase Auth REST implementation for Workers-compatible session cookies. Subpath exports: `./app` (client-side) and `./auth` (server-side).
- `packages/eslint-config` — Shared ESLint configs (legacy, oxlint is primary).
- `packages/typescript-config` — Shared tsconfig bases (`base.json`, `nextjs.json`, `react-library.json`).

### Type-Safe RPC (Hono RPC)

The API exports `AppType` from `apps/api/src/index.ts`. The web app imports it via path alias (`api`) and creates type-safe clients:

- **Client components:** `hc<AppType>("")` in `apps/web/src/features/lib/api.ts` — same-origin (Next.js rewrites), browser sends cookies automatically.
- **Server components:** `getServerApi()` in `apps/web/src/features/lib/server-api.ts` — creates `hc<AppType>(NEXT_PUBLIC_API_URL)` with cookies forwarded from `next/headers`, wrapped in React `cache()` to deduplicate within a render.

### Authentication

Firebase Authentication with session cookies (`otography_session`, 5-day expiry). The API uses Firebase Admin SDK; client-facing auth operations use the Firebase REST API. OAuth (Google, Apple) via Firebase Identity Platform with `jose` for OAuth state JWT signing.

Next.js middleware (`apps/web/proxy.ts`) guards authenticated routes. It redirects to `/login` only when both the session cookie and refresh token cookie are absent — if a refresh token exists, the request passes through so the API can auto-refresh the session.

### Database

PostgreSQL with Drizzle ORM and `postgres.js` driver. Row-Level Security (RLS) is enforced on all tables. Three RLS helpers in `apps/api/src/shared/db/rls.ts`:

- `withRls(db, fn)` — sets JWT claims via `requesting_user_id()` and switches to `authenticated` role. Uses a `SECURITY DEFINER` function `resolve_firebase_id()` to map Firebase ID to user UUID.
- `withAuthenticatedRole(db, fn)` — sets `authenticated` role without JWT claims.
- `withAnonymousRole(db, fn)` — sets `anon` role.

Prepared statements are disabled (`prepare: false`) due to Supabase Transaction pool mode. Insert/update schemas use `drizzle-orm/arktype` (`createInsertSchema`/`createUpdateSchema`).

Database connection uses a `globalThis` singleton pattern to avoid connection pool exhaustion in development.

### Error Handling

Uses the **errore** convention: functions return error objects instead of throwing. Callers check `instanceof Error` and TypeScript narrows the type. Errors carry `statusCode` (Hono `ContentfulStatusCode`) and optional `clearCookie` flag. See `.claude/skills/errore/` for the full pattern guide.

### Testing

Test behavior, not implementation. Mock only at boundaries (Firebase, database, third-party APIs), not internal modules. Prefer fewer, higher-impact tests — every test must be able to fail for a real defect. Failure messages must be actionable (`toMatchObject` over `toEqual` for large objects). See `.claude/skills/agentic-testing/SKILL.md` for the full guidelines.

### Validation

Arktype (`arktype`) for runtime type validation in the API — request bodies and DB insert schemas. The web app uses `valibot` via `@t3-oss/env-nextjs` for env vars. Do not use Zod.

### UI & Component Architecture

Compound component pattern with React Context and `use()` (React 19 API). Prefer composition over boolean props — use explicit variant components instead of `mode` or `variant` props. Use `children` for composition rather than render props. Do not use `forwardRef` (React 19). See `.claude/skills/vercel-composition-patterns/AGENTS.md` for the full guidelines.

## Code Style

- **Formatter:** oxfmt — 100 char width, spaces (width 2), semicolons, double quotes, trailing commas
- **Linter:** oxlint (replaces ESLint) — type-aware linting available via `--type-aware` flag
- **Git hooks:** Lefthook runs `oxfmt --write` and `oxlint --fix` on staged files at pre-commit. Excludes `.agents/` and `.claude/`.
- Source code comments are in Japanese

## Environment

The API uses Wrangler for environment variable management. Non-secret vars are defined in `wrangler.jsonc` (`vars` field); secrets are provided via `.dev.vars` in local development (read by `wrangler dev`) and via Cloudflare dashboard/secrets in production. Wrangler also manages rate limiting (e.g., `LIKE_RATE_LIMITER`: 30 req/60s). Drizzle has a separate `env.drizzle.ts` that reads `DATABASE_URL` / `DATABASE_DIRECT_URL` from `process.env` (set inline in `db:*` npm scripts), so migration commands don't need all app env vars. The web app uses `@t3-oss/env-nextjs` with `valibot` for type-safe env access, and `dotenvx` in the `dev` script.
