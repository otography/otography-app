import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { client } from "#/lib/api";

export type PostView = InferResponseType<(typeof client.api.posts)[":id"]["$get"], 200>;

export async function createPost(input: { songId: string; isrc: string; content: string }) {
  const res = await client.api.posts.$post({ json: input });
  const body = await res.json();
  if ("error" in body) throw new Error(body.error);
  return body;
}

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
