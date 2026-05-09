import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { DbError } from "@repo/errors";
import { createDb } from "../../shared/db";
import { withRls } from "../../shared/db/rls";
import { toDbError } from "../../shared/db/postgres-error";
import { domainDbError } from "../../shared/errors/domain-error";
import { findActivePostById } from "../posts/repository";
import { countPostLikes, togglePostLike } from "./repository";
import type { ToggleLikeResponse } from "./model";

export const toggleLike = async (
  session: DecodedIdToken,
  postId: string,
): Promise<ToggleLikeResponse | DbError> => {
  const db = createDb();
  const result = await withRls(db, session, async (tx, userId) => {
    const post = await findActivePostById(tx, postId);
    if (!post) {
      return domainDbError({
        slug: "post-not-found",
        message: "投稿が見つかりません。",
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
    return toDbError(result, "いいねの操作に失敗しました。");
  }

  return result;
};
