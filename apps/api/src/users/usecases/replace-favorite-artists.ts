import type { z } from "zod";
import { getOrCreateArtist } from "../../artists/repository.ts";
import type { CatalogArtist } from "../../lib/apple-music/catalog.ts";
import type { Database } from "../../lib/db.ts";
import { DuplicateFavoriteArtistError } from "../errors.ts";
import { replaceFavoriteArtists } from "../repository.ts";
import type { replaceFavoriteArtistsInput } from "../schemas.ts";
import { decorationOf } from "./favorite-decoration.ts";
import { getProfileOfUser } from "./get-profile.ts";

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
  if (duplicate) {
    return new DuplicateFavoriteArtistError({ artistId: duplicate.artistId });
  }

  // アーティストを確定させ、保存する行を作る。
  const resolved = await Promise.all(
    input.items.map(async (item) => {
      const artist = await getOrCreateArtist({ db, artistId: item.artistId, fetchArtist });
      return artist instanceof Error ? artist : { artistId: artist.id, ...decorationOf(item) };
    }),
  );
  const items: Parameters<typeof replaceFavoriteArtists>[0]["items"] = [];
  for (const [position, row] of resolved.entries()) {
    if (row instanceof Error) {
      return row;
    }
    items.push({ ...row, position });
  }

  const replaced = await replaceFavoriteArtists({ db, userId, items });
  if (replaced instanceof Error) {
    return replaced;
  }

  return getProfileOfUser({ db, userId });
}
