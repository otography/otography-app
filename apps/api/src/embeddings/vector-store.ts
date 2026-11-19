import type { EmbeddingRequestError, VectorStoreError } from "./errors.ts";

/** 埋め込みを作るモデル（Workers AI）。x の出どころとして、D1 の行にも残す。 */
export const EMBEDDING_SOURCE = "@cf/pfnet/plamo-embedding-1b";

/**
 * 元のベクトル x を入れる D1 の表。D1 は Drizzle のマイグレーションの外にあるので、使う前に毎回この文で作る。
 * embedding は半精度のバイト列（2 バイト × 2048 次元、約 4KB）。変換 A を作り直すときだけ読む。
 */
export const VECTOR_STORE_SCHEMA = `CREATE TABLE IF NOT EXISTS x_vectors (
  post_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  embedding BLOB NOT NULL,
  created_at INTEGER NOT NULL
)`;

/** 文の配列から x の配列を作る（同じ順）。 */
export type Embedder = (texts: string[]) => Promise<EmbeddingRequestError | Float32Array[]>;

/** x の置き場所（D1）。Worker からはバインディング、バッチからは REST API で使う。 */
export type VectorStore = {
  /** 入れる。同じ post_id の行が既にあれば、そのままにする。 */
  put: (rows: { postId: string; x: Float32Array }[]) => Promise<VectorStoreError | null>;
  /** 指定した投稿の x を読む。無い投稿は結果に含めない。 */
  get: (postIds: string[]) => Promise<VectorStoreError | Map<string, Float32Array>>;
};
