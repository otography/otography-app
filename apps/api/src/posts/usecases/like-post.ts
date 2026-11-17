import type { Database } from "../../lib/db.ts";
import { PostNotFoundError } from "../errors.ts";
import { deleteLike, insertLike } from "../repository.ts";

/** 投稿にいいねを付ける。付け済みでも成功として扱う（何度送っても結果は同じ）。 */
export async function likePost({
  db,
  userId,
  postId,
}: {
  db: Database;
  userId: string;
  postId: string;
}) {
  const likeCount = await insertLike({ db, userId, postId });
  if (likeCount instanceof Error) return likeCount;
  if (likeCount === null) return new PostNotFoundError({ postId });
  return { likeCount, likedByMe: true };
}

/** 投稿のいいねを外す。付けていなくても成功として扱う。 */
export async function unlikePost({
  db,
  userId,
  postId,
}: {
  db: Database;
  userId: string;
  postId: string;
}) {
  const likeCount = await deleteLike({ db, userId, postId });
  if (likeCount instanceof Error) return likeCount;
  if (likeCount === null) return new PostNotFoundError({ postId });
  return { likeCount, likedByMe: false };
}
