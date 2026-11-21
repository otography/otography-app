import { env } from "cloudflare:workers";
import { EMBEDDING_MODEL } from "db/constants";
import { db } from "../lib/db.ts";
import { logError } from "../lib/log.ts";
import { EmbeddingRequestError, VectorStoreError } from "./errors.ts";
import { loadTransform } from "./transform.ts";
import type { Transform } from "./transform.ts";
import { embedPosts } from "./usecases/embed-posts.ts";
import { EMBEDDING_SOURCE, VECTOR_STORE_SCHEMA } from "./vector-store.ts";
import type { Embedder, VectorStore } from "./vector-store.ts";
import { decodeHalf, encodeHalf } from "./vectors.ts";

// Worker のバインディング（cloudflare.config.ts の AI と X_STORE）を使う実装。テストからは読み込まない。

export const embed: Embedder = async (texts) => {
  const result = await env.AI.run(EMBEDDING_SOURCE, { text: texts }).catch(
    (error: unknown) => new EmbeddingRequestError({ cause: error }),
  );
  if (result instanceof Error) {
    return result;
  }
  if (!("data" in result) || !result.data) {
    return new EmbeddingRequestError({ cause: new Error("応答に data が無い") });
  }
  return result.data.map((vector) => Float32Array.from(vector));
};

// 表を作る文は、isolate ごとに 1 回だけ実行する。
let schemaReady: Promise<VectorStoreError | null> | null = null;
const ensureSchema = () => {
  schemaReady ??= env.X_STORE.prepare(VECTOR_STORE_SCHEMA)
    .run()
    .then(
      () => null,
      (error: unknown) => {
        schemaReady = null;
        return new VectorStoreError({ cause: error });
      },
    );
  return schemaReady;
};

export const store: VectorStore = {
  async put(rows) {
    const ready = await ensureSchema();
    if (ready instanceof Error) {
      return ready;
    }
    const now = Date.now();
    const statement = env.X_STORE.prepare(
      "INSERT OR IGNORE INTO x_vectors (post_id, source, embedding, created_at) VALUES (?, ?, ?, ?)",
    );
    return env.X_STORE.batch(
      rows.map((row) => statement.bind(row.postId, EMBEDDING_SOURCE, encodeHalf(row.x), now)),
    ).then(
      () => null,
      (error: unknown) => new VectorStoreError({ cause: error }),
    );
  },
  async get(postIds) {
    const ready = await ensureSchema();
    if (ready instanceof Error) {
      return ready;
    }
    const result = await env.X_STORE.prepare(
      `SELECT post_id, embedding FROM x_vectors WHERE post_id IN (${postIds.map(() => "?").join(", ")})`,
    )
      .bind(...postIds)
      .all<{ post_id: string; embedding: ArrayBuffer }>()
      .catch((error: unknown) => new VectorStoreError({ cause: error }));
    if (result instanceof Error) {
      return result;
    }
    return new Map(
      result.results.map((row) => [row.post_id, decodeHalf(new Uint8Array(row.embedding))]),
    );
  },
};

// 変換は約 2MB あるので、isolate ごとに 1 回だけ読む。まだ無い（null）ときは、次の投稿で読み直す。
let transform: Transform | null = null;
/** 今の EMBEDDING_MODEL の変換。まだ作っていなければ null。 */
export const currentTransform = async () => {
  if (transform) {
    return transform;
  }
  const loaded = await loadTransform({ db, model: EMBEDDING_MODEL });
  if (loaded instanceof Error) {
    return loaded;
  }
  transform = loaded;
  return transform;
};

/**
 * 投稿した直後に、その投稿の埋め込みを作る。応答を返した後に動かす（ctx.waitUntil）。
 * 失敗はログに残すだけにする。作れなかった投稿は、埋め込みのバッチが後で補う。
 */
export async function embedNewPost(post: { id: string; content: string }) {
  const loaded = await currentTransform();
  if (loaded instanceof Error) {
    logError(loaded);
  }
  const result = await embedPosts({
    db,
    embed,
    store,
    transform: loaded instanceof Error ? null : loaded,
    posts: [post],
  });
  if (result instanceof Error) {
    logError(result);
  }
}
