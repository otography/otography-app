# Otography App

Otography is a music-focused social app built as a Bun/Turborepo monorepo.

## Structure

- `apps/web` - Next.js 16 + React 19 web app
- `apps/api` - Hono API for Cloudflare Workers
- `packages/errors` - shared typed error classes
- `packages/firebase-auth-rest` - Firebase Auth REST implementation for Workers-compatible session cookies
- `packages/typescript-config` and `packages/eslint-config` - shared tooling config

## Requirements

- Bun `1.3.10`
- Nix, for the local PostgreSQL service
- PostgreSQL runs locally on port `54322`

## Setup

```bash
bun install
bun run hooks:install
just db-start
bun run --cwd apps/api db:migrate
```

The local database uses Supabase-compatible `authenticated` and `anon` roles.
The baseline migration enables `pg_uuidv7` and creates the RLS helper
function.

## Development

```bash
bun run dev
```

Useful targeted commands:

```bash
bun run dev --filter=web
bun run dev --filter=api
just db-stop
just db-reset
```

## Quality Checks

```bash
bun run check-types
bun run test
bun run test:db --filter=api
bun run quality
```

`test:db` resets the test database, applies Drizzle migrations, and verifies
schema/RLS behavior against PostgreSQL.

## Environment

Use the checked-in examples as templates:

- `apps/api/.dev.vars.example`
- `apps/web/.env.example`

The web app talks only to the API. Auth credentials, Firebase session-cookie
handling, and database access stay inside `apps/api`.
