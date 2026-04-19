import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { and, eq, isNull, sql } from "drizzle-orm";
import { posts } from "../../shared/db/schema";
import { withRls } from "../../shared/db/rls";
import { createDb } from "../../shared/db";

// 投稿を新規作成（userIdは事前に取得済み）
export const insertPost = async (
  claims: DecodedIdToken,
  values: { content: string; songId: string; userId: string },
) => {
  return withRls(claims, async (tx) =>
    tx
      .insert(posts)
      .values({ userId: values.userId, content: values.content, songId: values.songId })
      .returning(),
  );
};

// 投稿IDで単一投稿を取得（論理削除済みは除外）
export const selectPostById = async (postId: string) => {
  const db = createDb();
  return db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);
};

// 投稿内容を更新（所有者確認済み）
export const updatePostContent = async (
  claims: DecodedIdToken,
  postId: string,
  content: string,
) => {
  return withRls(claims, async (tx) =>
    tx
      .update(posts)
      .set({ content, embedding: null, updatedAt: sql`now()` })
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
      .returning(),
  );
};

// 投稿を論理削除（所有者確認済み）
export const softDeletePost = async (claims: DecodedIdToken, postId: string) => {
  return withRls(claims, async (tx) =>
    tx
      .update(posts)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
      .returning(),
  );
};

// 投稿のembeddingベクトルを更新（作成後のベストエフォート処理）
export const updatePostEmbedding = async (
  claims: DecodedIdToken,
  postId: string,
  embedding: number[],
) => {
  return withRls(claims, async (tx) =>
    tx
      .update(posts)
      .set({ embedding, updatedAt: sql`now()` })
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
      .returning(),
  );
};
