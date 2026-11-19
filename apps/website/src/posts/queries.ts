import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { client } from "#/lib/api";

/** 他人に見せる投稿 1 件（投稿者、曲、いいねの件数、自分がいいね済みか）。 */
export type PostView = InferResponseType<(typeof client.api.posts)[":id"]["$get"], 200>;

/** 投稿 1 件。 */
export const postQuery = (postId: string) =>
  queryOptions({
    queryKey: ["posts", "detail", postId],
    queryFn: async () => {
      const res = await client.api.posts[":id"].$get({ param: { id: postId } });
      const body = await res.json();
      if ("error" in body) throw new Error(body.error);
      return body;
    },
  });

/** 投稿に近い感想（3 件）。投稿の直後に出す。includeSameSong が false なら、同じ曲の感想を除く。 */
export const similarPostsQuery = (postId: string, includeSameSong: boolean) =>
  queryOptions({
    queryKey: ["posts", "similar", postId, includeSameSong],
    queryFn: async () => {
      const res = await client.api.posts[":id"].similar.$get({
        param: { id: postId },
        query: { sameSong: includeSameSong ? "include" : "exclude" },
      });
      const body = await res.json();
      if ("error" in body) throw new Error(body.error);
      return body.posts;
    },
  });

/** 短い言葉に近い感想。 */
export const searchPostsQuery = (q: string) =>
  queryOptions({
    queryKey: ["posts", "search", q],
    queryFn: async () => {
      const res = await client.api.posts.search.$get({ query: { q } });
      const body = await res.json();
      if ("error" in body) throw new Error(body.error);
      return body.posts;
    },
  });

/** ユーザーの投稿を新しい順に読む。続きは nextCursor で読む。 */
export const authorPostsQuery = (publicId: string) =>
  infiniteQueryOptions({
    queryKey: ["posts", "author", publicId],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.users[":publicId"].posts.$get({
        param: { publicId },
        // 最初のページは cursor を付けない（initialPageParam の空文字）。
        query: pageParam ? { cursor: pageParam } : {},
      });
      const body = await res.json();
      if ("error" in body) throw new Error(body.error);
      return body;
    },
    initialPageParam: "",
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
