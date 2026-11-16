import { songs } from "db";
import type { CatalogSong } from "../lib/apple-music/catalog.ts";
import type { FetchCatalogSongError } from "../lib/apple-music/errors.ts";
import type { Database } from "../lib/db.ts";
import { SongConflictError, SongQueryError } from "./errors.ts";

const findSong = ({ db, isrc }: { db: Database; isrc: string }) =>
  db.query.songs
    .findFirst({ where: { isrc } })
    .then((song) => song ?? null)
    .catch((e) => new SongQueryError({ isrc, cause: e }));

async function saveSong({ db, song }: { db: Database; song: CatalogSong }) {
  const inserted = await db
    .insert(songs)
    .values({ ...song, fetchedAt: new Date() })
    .onConflictDoNothing()
    .returning()
    .catch((e) => new SongQueryError({ isrc: song.isrc, cause: e }));
  if (inserted instanceof Error) return inserted;

  const [row] = inserted;
  if (row) return row;

  // 別のリクエストが同じ曲を先に保存した場合は、その行を返す。
  const existing = await findSong({ db, isrc: song.isrc });
  if (existing instanceof Error) return existing;
  if (!existing) return new SongConflictError({ isrc: song.isrc, appleSongId: song.appleSongId });
  return existing;
}

/**
 * 投稿やお気に入りで選ばれた曲を返す。songs に ISRC の行があれば Apple Music を呼ばない。
 * なければ songId で Apple Music から取得し、Apple が返した ISRC を主キーにして保存する。
 */
export async function findOrFetchSong({
  db,
  songId,
  isrc,
  fetchSong,
}: {
  db: Database;
  songId: string;
  isrc: string;
  fetchSong: (songId: string) => Promise<FetchCatalogSongError | CatalogSong>;
}) {
  const existing = await findSong({ db, isrc: isrc.toUpperCase() });
  if (existing instanceof Error) return existing;
  if (existing) return existing;

  const fetched = await fetchSong(songId);
  if (fetched instanceof Error) return fetched;

  return saveSong({ db, song: fetched });
}
