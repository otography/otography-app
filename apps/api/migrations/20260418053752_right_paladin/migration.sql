-- pgvector拡張を有効化 (冪等: 既に存在する場合はスキップ)
CREATE EXTENSION IF NOT EXISTS vector;

-- postsテーブルにembedding列を追加 (冪等: 既に存在する場合はスキップ)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- HNSW cosineインデックスを作成 (類似投稿検索用)
-- 部分インデックス: ソフトデリート済み・embedding NULLの行を除外 (冪等)
DROP INDEX IF EXISTS posts_embedding_cosine_idx;
CREATE INDEX posts_embedding_cosine_idx
  ON posts USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL AND deleted_at IS NULL;