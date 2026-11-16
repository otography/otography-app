import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FAVORITE_COMMENT_MAX, FAVORITE_LIMIT } from "db/constants";
import type { ReactNode } from "react";
import { client } from "#/lib/api";
import { type Profile, profileQuery } from "../queries";
import { type FavoriteDraft, FavoritesContext } from "./context";
import { decorationOf, useFavoriteDrafts } from "./use-favorite-drafts";

const toDrafts = (profile: Profile): FavoriteDraft[] =>
  profile.favoriteSongs.map((favorite) => ({
    key: favorite.song.isrc,
    target: { songId: favorite.song.appleSongId, isrc: favorite.song.isrc },
    title: favorite.song.title ?? "（曲名なし）",
    subtitle: favorite.song.artistName,
    artworkUrl: favorite.song.artworkUrl,
    comment: favorite.comment ?? "",
    emoji: favorite.emoji ?? "",
    color: favorite.color,
  }));

/** お気に入りの曲の編集。状態の持ち方と PUT /api/me/favorite-songs の呼び方は、この Provider だけが知っている。 */
export function FavoriteSongsProvider({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const drafts = useFavoriteDrafts(toDrafts(profile));

  const save = useMutation({
    mutationFn: async (items: FavoriteDraft[]) => {
      const res = await client.api.me["favorite-songs"].$put({
        json: {
          items: items.map((item) => ({
            songId: item.target.songId!,
            isrc: item.target.isrc!,
            ...decorationOf(item),
          })),
        },
      });
      const body = await res.json();
      if ("error" in body) throw new Error(body.error);
      return body;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(profileQuery(next.publicId).queryKey, next);
      drafts.reset(toDrafts(next));
    },
  });

  return (
    <FavoritesContext
      value={{
        state: {
          items: drafts.items,
          dirty: drafts.dirty,
          isSaving: save.isPending,
          error: save.error?.message ?? null,
          saved: save.isSuccess && !drafts.dirty,
        },
        actions: { ...drafts.actions, save: () => save.mutate(drafts.items) },
        meta: { label: "曲", max: FAVORITE_LIMIT, commentMax: FAVORITE_COMMENT_MAX },
      }}
    >
      {children}
    </FavoritesContext>
  );
}
