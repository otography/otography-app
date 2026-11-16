import type { Song } from "db";
import type { z } from "zod";
import type { CatalogSong } from "../../lib/apple-music/catalog.ts";
import type { Database } from "../../lib/db.ts";
import { getOrCreateSong } from "../../songs/repository.ts";
import { DuplicateFavoriteSongError, UserQueryError } from "../errors.ts";
import { findUserById, replaceFavoriteSongs } from "../repository.ts";
import type { replaceFavoriteSongsInput } from "../schemas.ts";
import { getProfile } from "./get-profile.ts";

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
  const resolved = await Promise.all(
    input.items.map((item) =>
      getOrCreateSong({ db, songId: item.songId, isrc: item.isrc, fetchSong }),
    ),
  );
  const songs: Song[] = [];
  for (const song of resolved) {
    if (song instanceof Error) return song;
    songs.push(song);
  }

  // 入力の ISRC が違っても、Apple が返した ISRC が同じなら同じ曲なので、確定した曲で重複を確かめる。
  const seen = new Set<string>();
  const duplicate = songs.find((song) => seen.size === seen.add(song.isrc).size);
  if (duplicate) return new DuplicateFavoriteSongError({ isrc: duplicate.isrc });

  const replaced = await replaceFavoriteSongs({
    db,
    userId,
    items: input.items.map((item, position) => ({
      songIsrc: songs[position]!.isrc,
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
