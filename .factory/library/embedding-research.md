# Workers AI & pgvector Research

Technical research findings for embedding pipeline implementation.

**What belongs here:** API references, model specs, integration patterns, gotchas.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## Cloudflare Workers AI Binding

### Configuration (wrangler.jsonc)

```jsonc
{
  "ai": {
    "binding": "AI",
  },
}
```

### TypeScript Types

```typescript
import { Ai } from "@cloudflare/workers-types"; // or cloudflare:workers

interface Bindings {
  AI: Ai;
}
```

### Embedding API Call

```typescript
const response = await env.AI.run("@cf/qwen/qwen3-embedding-0.6b", {
  text: ["テキスト内容"],
});

// response.data[0] → number[] (1024 dimensions)
```

## Available Embedding Models on Workers AI

| Model               | ID                               | Dims | Max Tokens | Price ($/M) | Notes                                      |
| ------------------- | -------------------------------- | ---- | ---------- | ----------- | ------------------------------------------ |
| Qwen3-Emb-0.6B      | `@cf/qwen/qwen3-embedding-0.6b`  | 1024 | 4,096      | $0.012      | **Selected** - best multilingual, cheapest |
| EmbeddingGemma-300M | `@cf/google/embeddinggemma-300m` | 768  | 512        | ~$0.008     | Too short (512 tokens)                     |
| BGE-M3              | `@cf/baai/bge-m3`                | 1024 | 8,192      | $0.020      | 40% more expensive, lower MTEB             |
| BGE-large-en-v1.5   | `@cf/baai/bge-large-en-v1.5`     | 1024 | 512        | $0.020      | English only                               |

## Qwen3-Embedding-0.6B MTEB Benchmarks

| Benchmark                | Score | Notes                  |
| ------------------------ | ----- | ---------------------- |
| MTEB English             | 70.70 | +18.7% over BGE-M3     |
| MTEB Multilingual        | 64.64 | +8% over BGE-M3        |
| CMTEB (Chinese-Japanese) | 66.83 | Strong CJK performance |
| MTEB Code                | 80.83 | Code retrieval         |

## Drizzle ORM pgvector Reference

### Import

```typescript
import { vector } from "drizzle-orm/pg-core";
import { cosineDistance } from "drizzle-orm";
```

### Column Definition

```typescript
embedding: vector("embedding", { dimensions: 1024 });
// nullable by default
```

### HNSW Cosine Index

```typescript
(table) => [
  index("posts_embedding_cosine_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
];
```

### Extension Migration

Drizzle does NOT auto-create the extension. Must use custom migration:

```bash
npx drizzle-kit generate --custom
```

Then write SQL:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Distance Helpers (for future similarity search)

```typescript
import { cosineDistance } from "drizzle-orm";

const similarity = sql<number>`1 - (${cosineDistance(posts.embedding, queryVector)})`;
```

## Gotchas

1. **`prepare: false`** — Must be maintained for all Drizzle queries (Supabase Transaction pool mode)
2. **No `CREATE EXTENSION` in Drizzle schema** — Must be a separate custom migration
3. **Workers AI binding requires paid plan** for production; free tier has limits
4. **Qwen3 token limit is 4096** — truncate input to ~8000 chars for CJK text
5. **`vector` type import** — from `drizzle-orm/pg-core`, NOT from `drizzle-orm`
