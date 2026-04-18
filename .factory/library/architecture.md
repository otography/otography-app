# Embedding Pipeline Architecture

How the text embedding pipeline works for music impression posts.

---

## Overview

When a user creates a post (music impression), the system:

1. Validates the post content via Arktype
2. Saves the post to PostgreSQL
3. Calls Workers AI (Qwen3-Embedding-0.6B) to generate a 1024-dimensional vector
4. Updates the post row with the embedding vector
5. If AI fails, post is saved with NULL embedding (graceful degradation)

## Components

```
apps/api/src/features/posts/
├── index.ts         → Re-exports route
├── route.ts         → Hono router (POST, GET, PATCH, DELETE)
├── repository.ts    → Drizzle DB queries for posts
├── usecase.ts       → Business logic (create, read, update, delete)
└── lib/
    └── embedding.ts → Workers AI embedding service
```

## Data Flow: Post Creation with Embedding

```
Client → POST /api/posts { content, songId }
       → requireAuthMiddleware() — 認証チェック
       → csrfProtection() — CSRFチェック
       → Arktype validation — content (1-2000文字), songId (UUID)
       → PostUsecase.create()
         ├── PostRepository.create() — DB に投稿保存 (embedding = NULL)
         ├── EmbeddingService.generate(content) — Workers AI 呼び出し
         │   ├── 成功 → PostRepository.updateEmbedding(id, vector)
         │   └── 失敗 → ログ出力 (embedding = NULL のまま)
         └── 投稿データを返却
```

## Workers AI Integration

- **Binding**: `env.AI` (configured in `wrangler.jsonc`)
- **Model**: `@cf/qwen/qwen3-embedding-0.6b`
- **Dimensions**: 1024
- **Input limit**: 4096 tokens (~8000 chars CJK)
- **Pricing**: $0.012/M input tokens
- **Output**: `{ data: [Float32Array[1024]] }`

## Database Schema

```sql
-- pgvector拡張 (Supabase非依存、標準PostgreSQL拡張)
CREATE EXTENSION IF NOT EXISTS vector;

-- posts テーブルに embedding 列追加
ALTER TABLE posts ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- HNSW cosine インデックス (将来の類似検索用)
CREATE INDEX IF NOT EXISTS posts_embedding_cosine_idx
  ON posts USING hnsw (embedding vector_cosine_ops);
```

## Key Invariants

1. **Embedding failure never blocks post creation** — graceful degradation
2. **Embedding only generated on CREATE** — never on UPDATE
3. **Empty/whitespace content → NULL embedding** — no AI call
4. **pgvector is standard PostgreSQL** — no Supabase-specific APIs
5. **Workers AI binding only** — no REST API calls
