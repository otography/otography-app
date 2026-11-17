import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FAVORITE_COMMENT_MAX, FAVORITE_LIMIT } from "db/constants";
import type { ReactNode } from "react";
import { client } from "#/lib/api";
import { type Profile, profileQuery } from "../queries";
import { type FavoriteDraft, FavoritesContext } from "./context";
import { decorationOf, useFavoriteDrafts } from "./use-favorite-drafts";

const toDrafts = (profile: Profile): FavoriteDraft[] =>
  profile.favoriteArtists.map((favorite) => ({
    key: favorite.artist.id,
    target: { artistId: favorite.artist.id },
    title: favorite.artist.name ?? "（名前なし）",
    subtitle: null,
    artworkUrl: favorite.artist.artworkUrl,
    comment: favorite.comment ?? "",
    emoji: favorite.emoji ?? "",
    color: favorite.color,
  }));

/** お気に入りのアーティストの編集。状態の持ち方と PUT /api/me/favorite-artists の呼び方は、この Provider だけが知っている。 */
export function FavoriteArtistsProvider({
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
      const res = await client.api.me["favorite-artists"].$put({
        json: {
          items: items.map((item) => ({ artistId: item.target.artistId!, ...decorationOf(item) })),
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
        meta: { label: "アーティスト", max: FAVORITE_LIMIT, commentMax: FAVORITE_COMMENT_MAX },
      }}
    >
      {children}
    </FavoritesContext>
  );
}
