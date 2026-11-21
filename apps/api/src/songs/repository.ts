import { songs } from "db";
import type { CatalogSong } from "../lib/apple-music/catalog.ts";
import type { Database } from "../lib/db.ts";
import { findOrCreate, insertOrFindExisting } from "../lib/find-or-create.ts";
import { SongConflictError, SongQueryError } from "./errors.ts";

const findSong = ({ db, isrc }: { db: Database; isrc: string }) =>
  db.query.songs
    .findFirst({ where: { isrc } })
    .then((song) => song ?? null)
    .catch((error: unknown) => new SongQueryError({ isrc, cause: error }));

// 別のリクエストが同じ曲を先に保存した場合は、その行を返す。
const saveSong = ({ db, song }: { db: Database; song: CatalogSong }) =>
  insertOrFindExisting({
    insert: () =>
      db
        .insert(songs)
        .values({ ...song, fetchedAt: new Date() })
        .onConflictDoNothing()
        .returning()
        .catch((error: unknown) => new SongQueryError({ isrc: song.isrc, cause: error })),
    find: () => findSong({ db, isrc: song.isrc }),
    missing: () => new SongConflictError({ isrc: song.isrc, appleSongId: song.appleSongId }),
  });

/**
 * 投稿やお気に入りで選ばれた曲を返す。songs に ISRC の行があれば Apple Music を呼ばない。
 * なければ songId で Apple Music から取得し、Apple が返した ISRC を主キーにして保存する。
 */
export function getOrCreateSong<FetchError extends Error>({
  db,
  songId,
  isrc,
  fetchSong,
}: {
  db: Database;
  songId: string;
  isrc: string;
  fetchSong: (songId: string) => Promise<FetchError | CatalogSong>;
}) {
  return findOrCreate({
    find: () => findSong({ db, isrc: isrc.toUpperCase() }),
    create: async () => {
      const fetched = await fetchSong(songId);
      return fetched instanceof Error ? fetched : saveSong({ db, song: fetched });
    },
  });
}
