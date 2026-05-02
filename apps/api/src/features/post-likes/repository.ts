import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { DbError } from "@repo/errors";
import type { DatabaseOrTransaction, DatabaseTransaction } from "../../shared/db";
import { posts, postLikes } from "../../shared/db/schema";

// 投稿の存在確認（soft-deleted除外）
export const findActivePostById = async (db: DatabaseOrTransaction, id: string) => {
  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
};

// いいねトグル（1クエリ: CTEでDELETEを試み、削除0件ならINSERT）
export const togglePostLike = async (
  tx: DatabaseTransaction,
  userId: string,
  postId: string,
): Promise<{ liked: boolean }> => {
  const rows = await tx.execute<{ liked: boolean }>(sql`
    WITH deleted AS (
      DELETE FROM post_likes
      WHERE user_id = ${userId} AND post_id = ${postId}
      RETURNING user_id
    )
    INSERT INTO post_likes (user_id, post_id)
    SELECT ${userId}, ${postId}
    WHERE NOT EXISTS (SELECT 1 FROM deleted)
    RETURNING user_id
  `);

  // INSERTが成功 → liked=true, INSERTなし(DELETE成功) → liked=false
  return { liked: rows.length > 0 };
};

// 投稿ID配列に対するいいね数取得
export const countLikesByPostIds = async (
  db: DatabaseOrTransaction,
  postIds: string[],
): Promise<{ postId: string; count: number }[]> => {
  if (postIds.length === 0) return [];

  return db
    .select({
      postId: postLikes.postId,
      count: count(),
    })
    .from(postLikes)
    .where(inArray(postLikes.postId, postIds))
    .groupBy(postLikes.postId);
};

// ユーザーがいいね済みの投稿ID一覧
export const findUserLikesByPostIds = async (
  db: DatabaseOrTransaction,
  userId: string,
  postIds: string[],
): Promise<string[]> => {
  if (postIds.length === 0) return [];

  const rows = await db
    .select({ postId: postLikes.postId })
    .from(postLikes)
    .where(and(eq(postLikes.userId, userId), inArray(postLikes.postId, postIds)));

  return rows.map((r) => r.postId);
};

// 単一投稿のいいね数取得
export const countPostLikes = async (
  db: DatabaseOrTransaction,
  postId: string,
): Promise<number | DbError> => {
  const rows = await db
    .select({ count: count() })
    .from(postLikes)
    .where(eq(postLikes.postId, postId))
    .catch((e) => new DbError({ message: "いいね数の取得に失敗しました。", cause: e }));

  if (rows instanceof Error) return rows;

  return rows[0]?.count ?? 0;
};
