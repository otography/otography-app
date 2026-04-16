# Code Style and Conventions

## Formatter & Linter

- **Formatter**: oxfmt — 100 char width, 2-space indent, semicolons, double quotes, trailing commas
- **Linter**: oxlint (replaces ESLint)
- **Git hooks**: Lefthook runs oxfmt and oxlint --fix on staged files at pre-commit

## Code Conventions

- **Language**: TypeScript
- **Comments**: Source code comments are in Japanese
- **Error handling**: errore convention — functions return errors instead of throwing. Check `instanceof Error`.
- **Validation**: Arktype (`arktype`) for runtime validation. Do NOT use Zod.
- **UI library**: Formisch for forms. Valibot present in web but Arktype preferred.
- **React**: React 19 with React Compiler. No forwardRef. Use `use()` hook.
- **Component pattern**: Compound components with React Context. Composition over boolean props.
- **Environment**: `@t3-oss/env-core` (API) and `@t3-oss/env-nextjs` (web) for type-safe env vars.
- **Encrypted env**: dotenvx (`.env.x`)

## API Feature Structure

Each feature follows:

```
src/features/{feature}/
  ├── index.ts        # Export route
  ├── route.ts        # Hono route definitions
  ├── usecase.ts      # Business logic
  └── repository.ts   # Database queries (Drizzle ORM)
```

## Testing Conventions

- Test behavior, not implementation
- Mock only at boundaries (Firebase, database, third-party APIs)
- Prefer fewer, higher-impact tests
- Use `toMatchObject` over `toEqual` for large objects
- Framework: Vitest

## Naming

- Routes: kebab-case URLs (`/api/auth/sign-in`, `/api/user/profile`)
- Files: kebab-case (`firebase-rest.ts`, `csrf.middleware.ts`)
- DB tables: camelCase columns, snake_case table names via Drizzle mapping
