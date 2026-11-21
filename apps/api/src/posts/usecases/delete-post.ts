import type { Database } from "../../lib/db.ts";
import { PostNotFoundError } from "../errors.ts";
import { softDeletePost } from "../repository.ts";

/**
 * 本人の投稿を削除する（論理削除）。すべての画面から即座に消え、本文は 90 日後にバッチが物理削除する。
 * 他人の投稿は、存在を明かさないように、無い投稿と同じく見つからない扱いにする。
 */
export async function deletePost({
  db,
  postId,
  userId,
}: {
  db: Database;
  postId: string;
  userId: string;
}) {
  const deleted = await softDeletePost({ db, postId, userId });
  if (deleted instanceof Error) {
    return deleted;
  }
  if (deleted === null) {
    return new PostNotFoundError({ postId });
  }
  return null;
}
