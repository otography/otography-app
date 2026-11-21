import type { Database } from "../../lib/db.ts";
import { PostNotFoundError } from "../errors.ts";
import { writeLike } from "../repository.ts";

/**
 * 投稿にいいねを付ける（liked が true）か外す（false）。何度送っても結果は同じで、
 * 付け済みに付ける・付けていないものを外す場合も成功として扱う。
 */
export async function setLike({
  db,
  userId,
  postId,
  liked,
}: {
  db: Database;
  userId: string;
  postId: string;
  liked: boolean;
}) {
  const likeCount = await writeLike({ db, userId, postId, liked });
  if (likeCount instanceof Error) {
    return likeCount;
  }
  if (likeCount === null) {
    return new PostNotFoundError({ postId });
  }
  return { likeCount, likedByMe: liked };
}
