import type { z } from "zod";
import type { CatalogSong } from "../../lib/apple-music/catalog.ts";
import type { Database } from "../../lib/db.ts";
import { getOrCreateSong } from "../../songs/repository.ts";
import { DuplicateFavoriteSongError } from "../errors.ts";
import { replaceFavoriteSongs } from "../repository.ts";
import type { replaceFavoriteSongsInput } from "../schemas.ts";
import { decorationOf } from "./favorite-decoration.ts";
import { getProfileOfUser } from "./get-profile.ts";

/**
 * ログイン中のユーザーのお気に入りの曲を、一覧ごと置き換える。配列の順を並び順にする。
 * 未保存の曲は Apple Music から取得して保存する。置き換えた後のプロフィールを返す。
 */
export async function replaceFavoriteSongsOfUser<FetchError extends Error>({
  db,
  fetchSong,
  userId,
  input,
}: {
  db: Database;
  fetchSong: (songId: string) => Promise<FetchError | CatalogSong>;
  userId: string;
  input: z.output<typeof replaceFavoriteSongsInput>;
}) {
  // 曲を確定させ、保存する行を作る。
  const resolved = await Promise.all(
    input.items.map(async (item) => {
      const song = await getOrCreateSong({ db, songId: item.songId, isrc: item.isrc, fetchSong });
      return song instanceof Error ? song : { songIsrc: song.isrc, ...decorationOf(item) };
    }),
  );
  const items: Parameters<typeof replaceFavoriteSongs>[0]["items"] = [];
  for (const [position, row] of resolved.entries()) {
    if (row instanceof Error) {
      return row;
    }
    items.push({ ...row, position });
  }

  // 入力の ISRC が違っても、Apple が返した ISRC が同じなら同じ曲なので、確定した曲で重複を確かめる。
  const seen = new Set<string>();
  const duplicate = items.find((item) => seen.size === seen.add(item.songIsrc).size);
  if (duplicate) {
    return new DuplicateFavoriteSongError({ isrc: duplicate.songIsrc });
  }

  const replaced = await replaceFavoriteSongs({ db, userId, items });
  if (replaced instanceof Error) {
    return replaced;
  }

  return getProfileOfUser({ db, userId });
}
