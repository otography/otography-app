import type { Artist } from "db";
import type { z } from "zod";
import { getOrCreateArtist } from "../../artists/repository.ts";
import type { CatalogArtist } from "../../lib/apple-music/catalog.ts";
import type { Database } from "../../lib/db.ts";
import { DuplicateFavoriteArtistError, UserQueryError } from "../errors.ts";
import { findUserById, replaceFavoriteArtists } from "../repository.ts";
import type { replaceFavoriteArtistsInput } from "../schemas.ts";
import { getProfile } from "./get-profile.ts";

/**
 * ログイン中のユーザーのお気に入りのアーティストを、一覧ごと置き換える。配列の順を並び順にする。
 * 未保存のアーティストは Apple Music から取得して保存する。置き換えた後のプロフィールを返す。
 */
export async function replaceFavoriteArtistsOfUser<FetchError extends Error>({
  db,
  fetchArtist,
  userId,
  input,
}: {
  db: Database;
  fetchArtist: (artistId: string) => Promise<FetchError | CatalogArtist>;
  userId: string;
  input: z.output<typeof replaceFavoriteArtistsInput>;
}) {
  const seen = new Set<string>();
  const duplicate = input.items.find((item) => seen.size === seen.add(item.artistId).size);
  if (duplicate) return new DuplicateFavoriteArtistError({ artistId: duplicate.artistId });

  const resolved = await Promise.all(
    input.items.map((item) => getOrCreateArtist({ db, artistId: item.artistId, fetchArtist })),
  );
  const artists: Artist[] = [];
  for (const artist of resolved) {
    if (artist instanceof Error) return artist;
    artists.push(artist);
  }

  const replaced = await replaceFavoriteArtists({
    db,
    userId,
    items: input.items.map((item, position) => ({
      artistId: artists[position]!.id,
      comment: item.comment ?? null,
      emoji: item.emoji ?? null,
      color: item.color ?? null,
      position,
    })),
  });
  if (replaced instanceof Error) return replaced;

  const user = await findUserById({ db, userId });
  if (user instanceof Error) return user;
  if (!user) return new UserQueryError({ cause: new Error(`ユーザー ${userId} が DB にない`) });
  return getProfile({ db, publicId: user.publicId });
}
