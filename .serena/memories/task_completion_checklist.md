# Task Completion Checklist

Before finishing a task, run these checks:

1. **Format**: `bun run format` (or `bun run format:fix` to auto-fix)
2. **Lint**: `bun run lint` (or `bun run lint:fix` to auto-fix)
3. **Type check**: `bun run check-types`
4. **Tests**: `bun run test` (or scoped: `bun run test --filter=api`)
5. **Dead code**: `bun run check-dead-code` (if adding/removing exports)

Quick combined check: `bun run quality`

## System Info

- **OS**: Darwin (macOS)
- **Shell**: /bin/sh
- **git**: 2.50.1
- **Python**: 3.14.3
- **Note**: `rg` and `wget` not available. Use Glob/Grep tools instead.
