import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { PostView } from "./queries";

type Like = Pick<PostView, "likeCount" | "likedByMe">;
type AuthorPostsPage = { posts: PostView[]; nextCursor: string | null };

/** 削除した投稿を、投稿の一覧のキャッシュから外し、投稿 1 件のキャッシュを捨てる。 */
export function removePostFromCaches(queryClient: QueryClient, postId: string) {
  queryClient.setQueriesData<InfiniteData<AuthorPostsPage>>(
    { queryKey: ["posts", "author"] },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          posts: page.posts.filter((post) => post.id !== postId),
        })),
      },
  );
  void queryClient.invalidateQueries({ queryKey: ["posts", "detail", postId] });
}

/** 投稿 1 件と投稿の一覧のキャッシュにある、その投稿のいいねの状態を書き換える。 */
export function setLikeInCaches(queryClient: QueryClient, postId: string, like: Like) {
  queryClient.setQueryData<PostView>(["posts", "detail", postId], (post) =>
    post ? { ...post, ...like } : post,
  );
  queryClient.setQueriesData<InfiniteData<AuthorPostsPage>>(
    { queryKey: ["posts", "author"] },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          posts: page.posts.map((post) => (post.id === postId ? { ...post, ...like } : post)),
        })),
      },
  );
}
