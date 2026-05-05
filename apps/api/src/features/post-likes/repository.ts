import { eq, sql } from "drizzle-orm";
import { DbError } from "@repo/errors";
import type { DatabaseOrTransaction, DatabaseTransaction } from "../../shared/db";
import { postLikes } from "../../shared/db/schema";

// いいねトグル（1クエリ: 同一user/postを直列化し、DELETE 0件ならINSERT）
export const togglePostLike = async (
  tx: DatabaseTransaction,
  userId: string,
  postId: string,
): Promise<{ liked: boolean }> => {
  const rows = await tx.execute<{ liked: boolean }>(sql`
    WITH lock AS (
      SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text || ':' || ${postId}::text, 0))
    ),
    deleted AS (
      DELETE FROM post_likes
      WHERE user_id = ${userId}
        AND post_id = ${postId}
        AND EXISTS (SELECT 1 FROM lock)
      RETURNING user_id
    )
    INSERT INTO post_likes (user_id, post_id)
    SELECT ${userId}, ${postId}
    FROM lock
    WHERE NOT EXISTS (SELECT 1 FROM deleted)
    RETURNING user_id
  `);

  // INSERTが成功 → liked=true, INSERTなし(DELETE成功) → liked=false
  return { liked: rows.length > 0 };
};

// 単一投稿のいいね数取得
export const countPostLikes = async (
  db: DatabaseOrTransaction,
  postId: string,
): Promise<number | DbError> => {
  const result = await db
    .$count(postLikes, eq(postLikes.postId, postId))
    .catch((e) => new DbError({ message: "いいね数の取得に失敗しました。", cause: e }));

  if (result instanceof Error) return result;

  return result;
};
