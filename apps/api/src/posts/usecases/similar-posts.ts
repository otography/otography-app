import { EMBEDDING_MODEL, SIMILAR_CACHE_TTL_MS } from "db/constants";
import { EmbeddingUnavailableError } from "../../embeddings/errors.ts";
import { findSimilarPosts, searchPostsByText } from "../../embeddings/usecases/find-similar.ts";
import type { Transform } from "../../embeddings/transform.ts";
import type { Embedder, VectorStore } from "../../embeddings/vector-store.ts";
import type { Database } from "../../lib/db.ts";
import { logError } from "../../lib/log.ts";
import { PostNotFoundError } from "../errors.ts";
import {
  findValidSimilarCache,
  findVisiblePost,
  findVisiblePostsByIds,
  saveSimilarCache,
} from "../repository.ts";
import { type PostView, toPostView } from "./post-view.ts";

/** 投稿の直後に出す、似た感想の件数。 */
const SIMILAR_POSTS_LIMIT = 3;
/** 言葉で探したときに返す件数。 */
const SEARCH_POSTS_LIMIT = 20;

/** 埋め込みを使うのに要るもの。変換がまだ無いとき、transform は null。 */
type Embedding = { embed: Embedder; store: VectorStore; transform: Transform | null };

export type SimilarPostsResult = {
  posts: PostView[];
  expired: boolean;
  expiresAt: string;
};

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

/**
 * 見せてよい投稿に近い感想を返す（24 時間キャッシュ付き）。
 * 24 時間を過ぎた投稿は再検索せず expired: true を返す。
 * 24 時間以内ならキャッシュがあれば返し、無ければ類似検索を実行して保存する。
 */
export async function getSimilarPosts({
  db,
  embedding,
  postId,
  viewerId,
  includeSameSong,
  now = new Date(),
}: {
  db: Database;
  embedding: Embedding;
  postId: string;
  viewerId: string;
  includeSameSong: boolean;
  now?: Date;
}): Promise<SimilarPostsResult | Error> {
  const post = await findVisiblePost({ db, postId, viewerId });
  if (post instanceof Error) return post;
  if (!post) return new PostNotFoundError({ postId });

  const expiresAt = new Date(post.createdAt.getTime() + SIMILAR_CACHE_TTL_MS);
  if (now >= expiresAt) {
    return { posts: [], expired: true, expiresAt: expiresAt.toISOString() };
  }

  const cached = await findValidSimilarCache({ db, postId, includeSameSong, now });
  if (cached instanceof Error) return cached;
  if (cached) {
    const posts = await toPostViews({ db, ids: cached.postIds, viewerId });
    if (posts instanceof Error) return posts;
    return { posts, expired: false, expiresAt: cached.expiresAt.toISOString() };
  }

  const { transform } = embedding;
  if (!transform) return new EmbeddingUnavailableError({ model: EMBEDDING_MODEL });

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

  const hitIds = hits.map((hit) => hit.postId);
  const saved = await saveSimilarCache({
    db,
    postId,
    includeSameSong,
    similarPostIds: hitIds,
    expiresAt,
  });
  if (saved instanceof Error) logError(saved);

  const posts = await toPostViews({ db, ids: hitIds, viewerId });
  if (posts instanceof Error) return posts;
  return { posts, expired: false, expiresAt: expiresAt.toISOString() };
}

/** ローカル開発のシミュレーションでも本番と同じ 24 時間キャッシュ・期限切れ挙動を再現する。 */
export async function getLocalSimulatedSimilarPosts({
  db,
  postId,
  viewerId,
  includeSameSong,
  simulate,
  now = new Date(),
}: {
  db: Database;
  postId: string;
  viewerId: string;
  includeSameSong: boolean;
  simulate: () => Promise<PostView[]>;
  now?: Date;
}): Promise<SimilarPostsResult | Error> {
  const post = await findVisiblePost({ db, postId, viewerId });
  if (post instanceof Error) return post;
  if (!post) return new PostNotFoundError({ postId });

  const expiresAt = new Date(post.createdAt.getTime() + SIMILAR_CACHE_TTL_MS);
  if (now >= expiresAt) {
    return { posts: [], expired: true, expiresAt: expiresAt.toISOString() };
  }

  const cached = await findValidSimilarCache({ db, postId, includeSameSong, now });
  if (cached instanceof Error) return cached;
  if (cached) {
    const posts = await toPostViews({ db, ids: cached.postIds, viewerId });
    if (posts instanceof Error) return posts;
    return { posts, expired: false, expiresAt: cached.expiresAt.toISOString() };
  }

  const simulated = await simulate();
  const visibleSimulated = await toPostViews({
    db,
    ids: simulated.map((p) => p.id),
    viewerId,
  });
  if (visibleSimulated instanceof Error) return visibleSimulated;

  // シミュレーション投稿が DB に実在する場合のみキャッシュに保存する（FK 制約を満たすため）。
  if (visibleSimulated.length > 0) {
    const saved = await saveSimilarCache({
      db,
      postId,
      includeSameSong,
      similarPostIds: visibleSimulated.map((p) => p.id),
      expiresAt,
    });
    if (saved instanceof Error) logError(saved);
    return { posts: visibleSimulated, expired: false, expiresAt: expiresAt.toISOString() };
  }

  return { posts: simulated, expired: false, expiresAt: expiresAt.toISOString() };
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
