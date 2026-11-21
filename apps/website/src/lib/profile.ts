import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type { FavoriteColor } from "db/constants";
import type { InferResponseType } from "hono/client";
import { client } from "#/lib/api";

export type ProfileView = InferResponseType<(typeof client.api.users)[":publicId"]["$get"], 200>;
export type FavoriteSongItem = ProfileView["favoriteSongs"][number];
export type FavoriteArtistItem = ProfileView["favoriteArtists"][number];
export type AuthorPostsPage = InferResponseType<
  (typeof client.api.users)[":publicId"]["posts"]["$get"],
  200
>;

export type FavoriteDecoration = {
  comment: string | null;
  emoji: string | null;
  color: FavoriteColor | null;
};

export type ReplaceFavoriteSongInput = {
  songId: string;
  isrc: string;
  comment: string | null;
  emoji: string | null;
  color?: FavoriteColor | null;
};

export type ReplaceFavoriteArtistInput = {
  artistId: string;
  comment: string | null;
  emoji: string | null;
  color?: FavoriteColor | null;
};

export const profileQuery = (publicId: string) =>
  queryOptions({
    queryKey: ["users", "profile", publicId],
    queryFn: async () => {
      const res = await client.api.users[":publicId"].$get({ param: { publicId } });
      const body = await res.json();
      if ("error" in body) {
        throw new Error(body.error);
      }
      return body;
    },
  });

export const authorPostsInfiniteQuery = (publicId: string) =>
  infiniteQueryOptions({
    queryKey: ["users", "posts", publicId],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const res = await client.api.users[":publicId"].posts.$get({
        param: { publicId },
        query: pageParam ? { cursor: pageParam } : {},
      });
      const body = await res.json();
      if ("error" in body) {
        throw new Error(body.error);
      }
      return body;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export async function updateProfile(input: { name?: string; bio?: string }) {
  const res = await client.api.me.$patch({ json: input });
  const body = await res.json();
  if ("error" in body) {
    throw new Error(body.error);
  }
  return body;
}

export async function replaceFavoriteSongs(items: Array<ReplaceFavoriteSongInput>) {
  const res = await client.api.me["favorite-songs"].$put({ json: { items } });
  const body = await res.json();
  if ("error" in body) {
    throw new Error(body.error);
  }
  return body;
}

export async function replaceFavoriteArtists(items: Array<ReplaceFavoriteArtistInput>) {
  const res = await client.api.me["favorite-artists"].$put({ json: { items } });
  const body = await res.json();
  if ("error" in body) {
    throw new Error(body.error);
  }
  return body;
}

export async function deletePost(postId: string) {
  const res = await client.api.posts[":id"].$delete({ param: { id: postId } });
  if (res.status === 204) {
    return;
  }
  const body = await res.json();
  if ("error" in body) {
    throw new Error(body.error);
  }
  throw new Error("投稿を削除できませんでした");
}

export async function setPostLike(postId: string, liked: boolean) {
  const res = liked
    ? await client.api.posts[":id"].like.$put({ param: { id: postId } })
    : await client.api.posts[":id"].like.$delete({ param: { id: postId } });
  const body = await res.json();
  if ("error" in body) {
    throw new Error(body.error);
  }
  return body;
}
