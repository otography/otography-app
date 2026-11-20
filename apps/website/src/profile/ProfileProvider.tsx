import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createToaster } from "@ui-sdk/react/toast";
import { FAVORITE_COMMENT_MAX, FAVORITE_LIMIT, USER_BIO_MAX, USER_NAME_MAX } from "db/constants";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { type Me, meQuery } from "#/lib/auth";
import { type AppleArtist, type AppleSong, catalogSongsQuery } from "#/lib/musickit";
import {
  type AuthorPostsPage,
  type FavoriteArtistItem,
  type FavoriteDecoration,
  type FavoriteSongItem,
  type ReplaceFavoriteArtistInput,
  type ReplaceFavoriteSongInput,
  authorPostsInfiniteQuery,
  deletePost as deletePostApi,
  profileQuery,
  replaceFavoriteArtists,
  replaceFavoriteSongs,
  setPostLike,
  updateProfile as updateProfileApi,
} from "#/lib/profile";
import { ProfileContext } from "./ProfileContext";

function toSongInputs(items: FavoriteSongItem[]): ReplaceFavoriteSongInput[] {
  return items.map((item) => ({
    songId: item.song.appleSongId,
    isrc: item.song.isrc,
    comment: item.comment,
    emoji: item.emoji,
    color: item.color,
  }));
}

function toArtistInputs(items: FavoriteArtistItem[]): ReplaceFavoriteArtistInput[] {
  return items.map((item) => ({
    artistId: item.artist.id,
    comment: item.comment,
    emoji: item.emoji,
    color: item.color,
  }));
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] | null {
  const target = index + direction;
  if (target < 0 || target >= items.length) return null;
  const next = items.slice();
  const [moved] = next.splice(index, 1);
  if (!moved) return null;
  next.splice(target, 0, moved);
  return next;
}

export function ProfileProvider({ user, children }: { user: Me; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [toaster] = useState(() => createToaster({ duration: 4000 }));
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [likingPostId, setLikingPostId] = useState<string | null>(null);

  useEffect(() => () => toaster.dismiss(), [toaster]);

  const profileOptions = profileQuery(user.publicId);
  const postsOptions = authorPostsInfiniteQuery(user.publicId);

  const profileRes = useQuery(profileOptions);
  const postsRes = useInfiniteQuery(postsOptions);

  const posts = useMemo(
    () => postsRes.data?.pages.flatMap((page) => page.posts) ?? [],
    [postsRes.data],
  );
  const favoriteSongs = profileRes.data?.favoriteSongs ?? [];
  const favoriteArtists = profileRes.data?.favoriteArtists ?? [];

  const songIds = useMemo(() => {
    const ids: string[] = [];
    for (const post of posts) {
      if (post.song?.appleSongId) ids.push(post.song.appleSongId);
    }
    for (const fav of favoriteSongs) {
      if (fav.song.appleSongId) ids.push(fav.song.appleSongId);
    }
    return ids;
  }, [posts, favoriteSongs]);

  const catalogRes = useQuery(catalogSongsQuery(songIds));
  const catalogSongs = useMemo(() => {
    const byId = new Map<string, AppleSong>();
    const byIsrc = new Map<string, AppleSong>();
    for (const song of catalogRes.data ?? []) {
      byId.set(song.id, song);
      if (song.attributes.isrc) {
        byIsrc.set(song.attributes.isrc.toUpperCase(), song);
      }
    }
    return { byId, byIsrc };
  }, [catalogRes.data]);

  const updateProfileMutation = useMutation({
    mutationFn: updateProfileApi,
    onSuccess: (updatedMe) => {
      queryClient.setQueryData(meQuery.queryKey, updatedMe);
      void queryClient.invalidateQueries({ queryKey: profileOptions.queryKey });
      toaster.success("プロフィールを更新しました");
    },
    onError: (error) => {
      toaster.error(error.message);
    },
  });

  const saveSongsMutation = useMutation({
    mutationFn: replaceFavoriteSongs,
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(profileOptions.queryKey, updatedProfile);
    },
    onError: (error) => {
      toaster.error(error.message);
    },
  });

  const saveArtistsMutation = useMutation({
    mutationFn: replaceFavoriteArtists,
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(profileOptions.queryKey, updatedProfile);
    },
    onError: (error) => {
      toaster.error(error.message);
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: deletePostApi,
    onMutate: (postId) => {
      setDeletingPostId(postId);
    },
    onSuccess: (_data, postId) => {
      queryClient.setQueryData<InfiniteData<AuthorPostsPage, string | null>>(
        postsOptions.queryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.filter((post) => post.id !== postId),
            })),
          };
        },
      );
      toaster.success("投稿を削除しました");
    },
    onError: (error) => {
      toaster.error(error.message);
    },
    onSettled: () => {
      setDeletingPostId(null);
    },
  });

  const likePostMutation = useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) =>
      setPostLike(postId, liked),
    onMutate: ({ postId }) => {
      setLikingPostId(postId);
    },
    onSuccess: (result, { postId }) => {
      queryClient.setQueryData<InfiniteData<AuthorPostsPage, string | null>>(
        postsOptions.queryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.map((post) =>
                post.id === postId
                  ? { ...post, likedByMe: result.likedByMe, likeCount: result.likeCount }
                  : post,
              ),
            })),
          };
        },
      );
    },
    onError: (error) => {
      toaster.error(error.message);
    },
    onSettled: () => {
      setLikingPostId(null);
    },
  });

  const addFavoriteSong = async (song: AppleSong, decoration: FavoriteDecoration) => {
    const isrc = song.attributes.isrc;
    if (!isrc) {
      toaster.error("この曲は登録できません");
      return;
    }
    if (favoriteSongs.length >= FAVORITE_LIMIT) {
      toaster.error(`好きな曲は最大 ${FAVORITE_LIMIT} 件までです`);
      return;
    }
    if (favoriteSongs.some((item) => item.song.isrc.toUpperCase() === isrc.toUpperCase())) {
      toaster.error("この曲はすでに登録されています");
      return;
    }
    const next: ReplaceFavoriteSongInput[] = [
      ...toSongInputs(favoriteSongs),
      {
        songId: song.id,
        isrc,
        comment: decoration.comment,
        emoji: decoration.emoji,
        color: decoration.color,
      },
    ];
    await saveSongsMutation.mutateAsync(next);
    toaster.success(`「${song.attributes.name}」を好きな曲に追加しました`);
  };

  const updateFavoriteSong = async (isrc: string, decoration: FavoriteDecoration) => {
    const next = toSongInputs(favoriteSongs).map((item) =>
      item.isrc === isrc
        ? { ...item, comment: decoration.comment, emoji: decoration.emoji, color: decoration.color }
        : item,
    );
    await saveSongsMutation.mutateAsync(next);
    toaster.success("好きな曲のメモを更新しました");
  };

  const removeFavoriteSong = async (isrc: string) => {
    const next = toSongInputs(favoriteSongs).filter((item) => item.isrc !== isrc);
    await saveSongsMutation.mutateAsync(next);
    toaster.success("好きな曲から削除しました");
  };

  const moveFavoriteSong = async (index: number, direction: -1 | 1) => {
    const reordered = moveItem(favoriteSongs, index, direction);
    if (!reordered) return;
    await saveSongsMutation.mutateAsync(toSongInputs(reordered));
  };

  const addFavoriteArtist = async (artist: AppleArtist, decoration: FavoriteDecoration) => {
    if (favoriteArtists.length >= FAVORITE_LIMIT) {
      toaster.error(`好きなアーティストは最大 ${FAVORITE_LIMIT} 件までです`);
      return;
    }
    if (favoriteArtists.some((item) => item.artist.id === artist.id)) {
      toaster.error("このアーティストはすでに登録されています");
      return;
    }
    const next: ReplaceFavoriteArtistInput[] = [
      ...toArtistInputs(favoriteArtists),
      {
        artistId: artist.id,
        comment: decoration.comment,
        emoji: decoration.emoji,
        color: decoration.color,
      },
    ];
    await saveArtistsMutation.mutateAsync(next);
    toaster.success(`「${artist.attributes.name}」を好きなアーティストに追加しました`);
  };

  const updateFavoriteArtist = async (artistId: string, decoration: FavoriteDecoration) => {
    const next = toArtistInputs(favoriteArtists).map((item) =>
      item.artistId === artistId
        ? { ...item, comment: decoration.comment, emoji: decoration.emoji, color: decoration.color }
        : item,
    );
    await saveArtistsMutation.mutateAsync(next);
    toaster.success("好きなアーティストのメモを更新しました");
  };

  const removeFavoriteArtist = async (artistId: string) => {
    const next = toArtistInputs(favoriteArtists).filter((item) => item.artistId !== artistId);
    await saveArtistsMutation.mutateAsync(next);
    toaster.success("好きなアーティストから削除しました");
  };

  const moveFavoriteArtist = async (index: number, direction: -1 | 1) => {
    const reordered = moveItem(favoriteArtists, index, direction);
    if (!reordered) return;
    await saveArtistsMutation.mutateAsync(toArtistInputs(reordered));
  };

  return (
    <ProfileContext
      value={{
        state: {
          user,
          profile: profileRes.data ?? null,
          isProfilePending: profileRes.isPending,
          profileError: profileRes.isError ? profileRes.error.message : null,
          posts,
          isPostsPending: postsRes.isPending,
          postsError: postsRes.isError ? postsRes.error.message : null,
          hasNextPosts: Boolean(postsRes.hasNextPage),
          isFetchingNextPosts: postsRes.isFetchingNextPage,
          favoriteSongs,
          favoriteArtists,
          catalogSongs,
          isUpdatingProfile: updateProfileMutation.isPending,
          isSavingSongs: saveSongsMutation.isPending,
          isSavingArtists: saveArtistsMutation.isPending,
          deletingPostId,
          likingPostId,
        },
        actions: {
          updateProfile: async (input) => {
            await updateProfileMutation.mutateAsync(input);
          },
          addFavoriteSong,
          updateFavoriteSong,
          removeFavoriteSong,
          moveFavoriteSong,
          addFavoriteArtist,
          updateFavoriteArtist,
          removeFavoriteArtist,
          moveFavoriteArtist,
          deletePost: async (postId) => {
            await deletePostMutation.mutateAsync(postId);
          },
          toggleLike: async (postId, liked) => {
            await likePostMutation.mutateAsync({ postId, liked });
          },
          fetchMorePosts: () => {
            if (postsRes.hasNextPage && !postsRes.isFetchingNextPage) {
              void postsRes.fetchNextPage();
            }
          },
        },
        meta: {
          favoriteLimit: FAVORITE_LIMIT,
          favoriteCommentMax: FAVORITE_COMMENT_MAX,
          userNameMax: USER_NAME_MAX,
          userBioMax: USER_BIO_MAX,
          toaster,
        },
      }}
    >
      {children}
    </ProfileContext>
  );
}
