import { PostOutputError } from "../errors.ts";
import { postViewOutput } from "../schemas.ts";

/** リポジトリが読んだ投稿を、応答の形にする。閲覧者自身のいいねの行があれば、いいね済みとする。 */
export const toPostView = (post: { id: string; likes: Array<unknown> }) => {
  const output = postViewOutput.safeParse({ ...post, likedByMe: post.likes.length > 0 });
  if (!output.success) {
    return new PostOutputError({ postId: post.id, cause: output.error });
  }
  return output.data;
};

export type PostView = Exclude<ReturnType<typeof toPostView>, Error>;
