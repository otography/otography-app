import { EmbeddingUnavailableError } from "../../embeddings/errors.ts";
import { findSimilarPosts, searchPostsByText } from "../../embeddings/usecases/find-similar.ts";
import type { Transform } from "../../embeddings/transform.ts";
import type { Embedder, VectorStore } from "../../embeddings/vector-store.ts";
import type { Database } from "../../lib/db.ts";
import { EMBEDDING_MODEL } from "db/constants";
import { PostNotFoundError } from "../errors.ts";
import { findVisiblePost, findVisiblePostsByIds } from "../repository.ts";
import { toPostView } from "./post-view.ts";

/** 投稿の直後に出す、似た感想の件数。 */
const SIMILAR_POSTS_LIMIT = 3;
/** 言葉で探したときに返す件数。 */
const SEARCH_POSTS_LIMIT = 20;

/** 埋め込みを使うのに要るもの。変換がまだ無いとき、transform は null。 */
type Embedding = { embed: Embedder; store: VectorStore; transform: Transform | null };

/** 検索の結果（投稿の ID の並び）を、他人に見せる投稿の形にする。 */
async function toPostViews({
  db,
  ids,
  viewerId,
}: {
  db: Database;
  ids: string[];
  viewerId: string;
}) {
  const rows = await findVisiblePostsByIds({ db, ids, viewerId });
  if (rows instanceof Error) return rows;
  const views = [];
  for (const row of rows) {
    const view = toPostView(row);
    if (view instanceof Error) return view;
    views.push(view);
  }
  return views;
}

/** 見せてよい投稿に近い感想を返す。includeSameSong が false なら、同じ曲の感想を除く。 */
export async function getSimilarPosts({
  db,
  embedding,
  postId,
  viewerId,
  includeSameSong,
}: {
  db: Database;
  embedding: Embedding;
  postId: string;
  viewerId: string;
  includeSameSong: boolean;
}) {
  const { transform } = embedding;
  if (!transform) return new EmbeddingUnavailableError({ model: EMBEDDING_MODEL });
  const post = await findVisiblePost({ db, postId, viewerId });
  if (post instanceof Error) return post;
  if (!post) return new PostNotFoundError({ postId });

  const hits = await findSimilarPosts({
    db,
    embed: embedding.embed,
    store: embedding.store,
    transform,
    post,
    includeSameSong,
    limit: SIMILAR_POSTS_LIMIT,
  });
  if (hits instanceof Error) return hits;
  return toPostViews({ db, ids: hits.map((hit) => hit.postId), viewerId });
}

/** 短い言葉に近い感想を返す。 */
export async function searchPosts({
  db,
  embedding,
  text,
  viewerId,
}: {
  db: Database;
  embedding: Embedding;
  text: string;
  viewerId: string;
}) {
  const { transform } = embedding;
  if (!transform) return new EmbeddingUnavailableError({ model: EMBEDDING_MODEL });
  const hits = await searchPostsByText({
    db,
    embed: embedding.embed,
    transform,
    text,
    limit: SEARCH_POSTS_LIMIT,
  });
  if (hits instanceof Error) return hits;
  return toPostViews({ db, ids: hits.map((hit) => hit.postId), viewerId });
}
