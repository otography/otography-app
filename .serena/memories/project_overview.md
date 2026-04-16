# Otography App - Project Overview

## Purpose

Music-focused social platform where users can favorite artists/songs, post about songs, and interact with a community.

## Tech Stack

- **Runtime**: Bun (package manager: bun@1.3.10)
- **Monorepo**: Turborepo
- **API** (`apps/api`): Hono on Cloudflare Workers (wrangler dev), Drizzle ORM + postgres.js, PostgreSQL with RLS
- **Web** (`apps/web`): Next.js 16 (App Router) + React 19 with React Compiler, runs on port 3000
- **API port**: 3001 (via wrangler dev)
- **Shared packages**:
  - `packages/errors` — errore-based error classes (`createTaggedError`)
  - `packages/firebase-auth-rest` — Firebase REST API client
  - `packages/types` — Shared types
  - `packages/backend` — Backend shared utilities
  - `packages/typescript-config` — Shared tsconfig bases
  - `packages/eslint-config` — Legacy ESLint configs (oxlint is primary)

## Authentication

Firebase Auth with session cookies (`otography_session`, 5-day expiry).
API uses Firebase Admin SDK; client uses Firebase REST API.

## Type-Safe RPC

API exports `AppType` from `apps/api/src/index.ts`. Web creates type-safe client with `hc<AppType>()` in `apps/web/src/lib/api.ts`.

## Database

PostgreSQL with Drizzle ORM. Row-Level Security (RLS) enforced via `requesting_user_id()` function. Uses `withRls()` helper in `apps/api/src/shared/db/rls.ts`. Local DB managed via Nix (justfile commands).

## Code Structure (API)

- `src/features/{feature}/` — route.ts, usecase.ts, repository.ts pattern
- `src/shared/db/schema.ts` — All Drizzle table definitions
- `src/shared/middleware/` — auth, csrf middleware
- `src/shared/firebase-rest.ts` — Firebase REST API client
- `src/shared/firebase-auth.ts` — Firebase Admin SDK
