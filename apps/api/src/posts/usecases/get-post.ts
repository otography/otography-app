import type { Database } from "../../lib/db.ts";
import { PostNotFoundError } from "../errors.ts";
import { findVisiblePost } from "../repository.ts";
import { toPostView } from "./post-view.ts";

/** 見せてよい投稿を 1 件返す。閲覧者がいいね済みかを含める。 */
export async function getPost({
  db,
  postId,
  viewerId,
}: {
  db: Database;
  postId: string;
  viewerId: string;
}) {
  const post = await findVisiblePost({ db, postId, viewerId });
  if (post instanceof Error) return post;
  if (!post) return new PostNotFoundError({ postId });
  return toPostView(post);
}
