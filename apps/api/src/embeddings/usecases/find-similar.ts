import { postEmbeddings } from "db";
import { and, eq } from "drizzle-orm";
import type { Database } from "../../lib/db.ts";
import { EmbeddingSaveError } from "../errors.ts";
import { searchSimilarPosts } from "../search.ts";
import { project, type Transform } from "../transform.ts";
import type { Embedder, VectorStore } from "../vector-store.ts";
import { saveProjected } from "./embed-posts.ts";

/** vector_top_k で取る候補の数。可視性や除外の条件で減っても、limit 件が残るように多めに取る。 */
const CANDIDATES = 100;

/**
 * 投稿の z を返す。post_embeddings に無ければ（投稿の直後で、埋め込みがまだ終わっていないなど）、ここで作って保存する。
 * x が D1 にあればそれを使い、無ければ Workers AI で作って D1 にも入れる。
 */
async function vectorOfPost({
  db,
  embed,
  store,
  transform,
  post,
}: {
  db: Database;
  embed: Embedder;
  store: VectorStore;
  transform: Transform;
  post: { id: string; content: string };
}) {
  const saved = await db
    .select({ embedding: postEmbeddings.embedding })
    .from(postEmbeddings)
    .where(and(eq(postEmbeddings.postId, post.id), eq(postEmbeddings.model, transform.model)))
    .get()
    .catch((e) => new EmbeddingSaveError({ postId: post.id, cause: e }));
  if (saved instanceof Error) return saved;
  if (saved) return saved.embedding;

  const stored = await store.get([post.id]);
  if (stored instanceof Error) return stored;
  const x = await (async () => {
    const found = stored.get(post.id);
    if (found) return found;
    const created = await embed([post.content]);
    if (created instanceof Error) return created;
    const vector = created[0] ?? new Float32Array();
    const put = await store.put([{ postId: post.id, x: vector }]);
    if (put instanceof Error) return put;
    return vector;
  })();
  if (x instanceof Error) return x;

  const projected = await saveProjected({ db, transform, rows: [{ postId: post.id, x }] });
  if (projected instanceof Error) return projected;
  return project(transform, x).z;
}

/**
 * 投稿に近い感想を返す（スコアの大きい順）。その投稿自身は除く。
 * 曲をまたいで、同じ観点・感性の感想を探すのが目的なので、includeSameSong が false なら、同じ曲の投稿も除く
 * （docs/adr/0020-embedding-pca-without-whitening.md）。
 */
export async function findSimilarPosts({
  db,
  embed,
  store,
  transform,
  post,
  includeSameSong,
  limit,
}: {
  db: Database;
  embed: Embedder;
  store: VectorStore;
  transform: Transform;
  post: { id: string; content: string; songIsrc: string | null };
  includeSameSong: boolean;
  limit: number;
}) {
  const z = await vectorOfPost({ db, embed, store, transform, post });
  if (z instanceof Error) return z;
  // 統計による補正は使わない（ADR 0020）
  return searchSimilarPosts({
    db,
    z,
    metric: null,
    limit,
    candidates: CANDIDATES,
    exclude: { postId: post.id, songIsrc: includeSameSong ? null : post.songIsrc },
  });
}

/** 短い言葉に近い感想を返す（スコアの大きい順）。言葉は保存しない。 */
export async function searchPostsByText({
  db,
  embed,
  transform,
  text,
  limit,
}: {
  db: Database;
  embed: Embedder;
  transform: Transform;
  text: string;
  limit: number;
}) {
  const xs = await embed([text]);
  if (xs instanceof Error) return xs;
  const { z } = project(transform, xs[0] ?? new Float32Array());
  return searchSimilarPosts({ db, z, metric: null, limit, candidates: CANDIDATES });
}
