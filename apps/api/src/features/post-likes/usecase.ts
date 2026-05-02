import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { DbError } from "@repo/errors";
import { createDb } from "../../shared/db";
import { withRls } from "../../shared/db/rls";
import { countPostLikes, findActivePostById, togglePostLike } from "./repository";
import type { ToggleLikeResponse } from "./model";

// いいねトグル
export const toggleLike = async (
  session: DecodedIdToken,
  postId: string,
): Promise<ToggleLikeResponse | DbError> => {
  // 投稿存在確認
  const db = createDb();
  const post = await findActivePostById(db, postId);
  if (!post) {
    return new DbError({ message: "投稿が見つかりません。", statusCode: 404 });
  }

  // トグル実行
  const toggleResult = await withRls(session, async (tx, userId) => {
    return togglePostLike(tx, userId, postId);
  });

  if (toggleResult instanceof Error) {
    return new DbError({ message: "いいねの操作に失敗しました。", cause: toggleResult });
  }

  // いいね数取得
  const likeCount = await countPostLikes(db, postId);
  if (likeCount instanceof Error) return likeCount;

  return {
    liked: toggleResult.liked,
    likeCount,
  };
};

// 投稿のいいね数取得
export const getPostLikeCount = async (postId: string) => {
  const db = createDb();
  const likeCount = await countPostLikes(db, postId);
  if (likeCount instanceof Error) return likeCount;

  return { likeCount };
};
