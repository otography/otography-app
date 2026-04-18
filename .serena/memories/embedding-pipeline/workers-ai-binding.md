# Workers AI Binding Setup

## Files Modified

- `apps/api/wrangler.jsonc` — Added `"ai": { "binding": "AI" }` config
- `apps/api/src/shared/types/bindings.ts` — Added `AI: Ai` property with `import type { Ai } from "@cloudflare/workers-types"`
- `apps/api/vitest.config.ts` — Added `remoteBindings: false` to skip Cloudflare auth in tests

## Key Decisions

- **Type import**: `import type { Ai } from "@cloudflare/workers-types"` — `@cloudflare/workers-types` is a hoisted transitive dependency of `wrangler`
- **Vitest `remoteBindings: false`**: Required because AI bindings always access remote resources (Cloudflare API), which requires `wrangler login`. Setting `remoteBindings: false` in `cloudflareTest()` config skips the remote proxy session, allowing tests to run without authentication. Individual tests that use `env.AI` should mock it with `vi.mock()` or `env.AI.run` spy.
- **Wrangler config format**: JSONC with `"ai": { "binding": "AI" }` (not TOML-style `[ai]`)

## Usage in Route Handlers

```typescript
// env.AI is typed and accessible in route handlers
const response = await env.AI.run("@cf/qwen/qwen3-embedding-0.6b", {
  text: ["embedding化するテキスト"],
});
// response.data[0] → number[1024]
```

## Testing

- Future embedding service tests should mock `env.AI.run` with `vi.fn()` or `vi.spyOn`
- The `remoteBindings: false` setting means `env.AI` will be available but won't actually call Cloudflare's API
- Mock example: `vi.spyOn(env.AI, 'run').mockResolvedValue({ data: [new Float32Array(1024).fill(0.1)] })`
