import { postEmbeddings } from "db";
import type { Database } from "../../lib/db.ts";
import { EmbeddingSaveError } from "../errors.ts";
import { project } from "../transform.ts";
import type { Transform } from "../transform.ts";
import type { Embedder, VectorStore } from "../vector-store.ts";

/**
 * x から z を作って post_embeddings に入れる。既に行がある投稿はそのままにする。入れた件数を返す。
 * post_embeddings のトリガーが統計の差分ログを書く（packages/db の embedding_changes）。
 */
export async function saveProjected({
  db,
  transform,
  rows,
}: {
  db: Database;
  transform: Transform;
  rows: Array<{ postId: string; x: Float32Array }>;
}) {
  const [first, ...rest] = rows.map(({ postId, x }) => {
    const { z, norm } = project(transform, x);
    return db
      .insert(postEmbeddings)
      .values({ postId, embedding: z, norm, model: transform.model })
      .onConflictDoNothing();
  });
  if (first === undefined) {
    return 0;
  }
  const saved = await db
    .batch([first, ...rest])
    .catch(
      (error: unknown) => new EmbeddingSaveError({ postId: rows[0]?.postId ?? "", cause: error }),
    );
  if (saved instanceof Error) {
    return saved;
  }
  return rows.length;
}

/**
 * 投稿の本文から x を作り、D1 に入れる。変換があれば z も作って Turso に入れる。
 * 変換がまだ無い（transform が null）ときは x だけを入れ、z は変換を作った後にバッチが作る。
 */
export async function embedPosts({
  db,
  embed,
  store,
  transform,
  posts,
}: {
  db: Database;
  embed: Embedder;
  store: VectorStore;
  transform: Transform | null;
  posts: Array<{ id: string; content: string }>;
}) {
  if (posts.length === 0) {
    return { stored: 0, projected: 0 };
  }
  const xs = await embed(posts.map((post) => post.content));
  if (xs instanceof Error) {
    return xs;
  }

  const rows = posts.map((post, i) => ({ postId: post.id, x: xs[i] ?? new Float32Array() }));
  const stored = await store.put(rows);
  if (stored instanceof Error) {
    return stored;
  }

  if (!transform) {
    return { stored: rows.length, projected: 0 };
  }
  const projected = await saveProjected({ db, transform, rows });
  if (projected instanceof Error) {
    return projected;
  }
  return { stored: rows.length, projected };
}
