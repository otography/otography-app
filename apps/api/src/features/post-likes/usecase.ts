import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { DbError } from "@repo/errors";
import { createDb } from "../../shared/db";
import { withRls } from "../../shared/db/rls";
import { findActivePostById } from "../posts/repository";
import { countPostLikes, togglePostLike } from "./repository";
import type { ToggleLikeResponse } from "./model";

const POST_NOT_FOUND_TYPE_URI = "https://api.otography.com/errors/post-not-found";

export const toggleLike = async (
  session: DecodedIdToken,
  postId: string,
): Promise<ToggleLikeResponse | DbError> => {
  const db = createDb();
  const result = await withRls(db, session, async (tx, userId) => {
    const post = await findActivePostById(tx, postId);
    if (!post) {
      return new DbError({
        message: "投稿が見つかりません。",
        statusCode: 404,
        typeUri: POST_NOT_FOUND_TYPE_URI,
      });
    }

    const toggleResult = await togglePostLike(tx, userId, postId);

    const likeCount = await countPostLikes(tx, postId);
    if (likeCount instanceof Error) return likeCount;

    return {
      liked: toggleResult.liked,
      likeCount,
    };
  });

  if (result instanceof Error) {
    if (result instanceof DbError && result.statusCode !== 500) return result;
    return new DbError({ message: "いいねの操作に失敗しました。", cause: result });
  }

  return result;
};
