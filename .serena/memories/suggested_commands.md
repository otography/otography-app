# Suggested Commands

## Development

```bash
bun install                          # Install dependencies
just dev                             # Generate migrations + migrate + dev both apps
just api                             # API only
just web                             # Web only
bun run dev                          # Dev both apps (no migration)
bun run dev --filter=web             # Dev web only
bun run dev --filter=api             # Dev api only
```

## Database (via justfile)

```bash
just db-start                        # Start local PostgreSQL (Nix)
just db-stop                         # Stop local PostgreSQL
just db-reset                        # Reset local DB (data loss!)
just db-psql                         # Connect via psql
just db-generate                     # Generate Drizzle migrations
just db-migrate                      # Run migrations
just db-push                         # Push schema directly (dev)
just db-studio                       # Drizzle Studio
```

## Quality Checks

```bash
bun run quality                      # All quality checks (lint + format + dead code)
bun run quality:fix                  # Fix lint + format issues
bun run lint                         # oxlint
bun run lint:fix                     # oxlint --fix
bun run format                       # oxfmt --check
bun run format:fix                   # oxfmt (write)
bun run check-types                  # TypeScript type checking
bun run check-dead-code              # knip dead code detection
bun run test                         # Run all tests
bun run test --filter=api            # API tests only
bun run test --filter=web            # Web tests only
```

## Setup

```bash
just setup                           # pull -> install -> db-start -> db-migrate -> dev
```

## Git hooks (lefthook)

Pre-commit runs oxfmt --write then oxlint --fix on staged files automatically.
