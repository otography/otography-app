import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../shared/db";
import { artists, genres, songArtists, songGenres, songs } from "../../shared/db/schema";
import type { SongCreateDbValues } from "./model";

const songColumns = {
  id: songs.id,
  title: songs.title,
  appleMusicId: songs.appleMusicId,
  length: songs.length,
  isrcs: songs.isrcs,
  createdAt: songs.createdAt,
  updatedAt: songs.updatedAt,
} as const;

export const listSongs = async (db: DatabaseOrTransaction) => {
  return db
    .select(songColumns)
    .from(songs)
    .where(isNull(songs.deletedAt))
    .orderBy(desc(songs.createdAt));
};

// ジャンル名の配列から genres テーブルに find-or-create し、ID の配列を返す
const findOrCreateGenreIds = async (db: DatabaseOrTransaction, genreNames: string[]) => {
  if (genreNames.length === 0) return [];

  await db
    .insert(genres)
    .values(genreNames.map((name) => ({ name })))
    .onConflictDoNothing({ target: genres.name });

  const found = await db
    .select({ id: genres.id })
    .from(genres)
    .where(inArray(genres.name, genreNames));

  return found.map((r) => r.id);
};

// song_genres の紐付けを全置換
const syncSongGenres = async (db: DatabaseOrTransaction, songId: string, genreNames: string[]) => {
  await db.delete(songGenres).where(eq(songGenres.songId, songId));
  if (genreNames.length === 0) return;

  const genreIds = await findOrCreateGenreIds(db, genreNames);
  if (genreIds.length > 0) {
    await db.insert(songGenres).values(
      genreIds.map((genreId) => ({
        songId,
        genreId,
      })),
    );
  }
};

// song_artists の紐付けを全置換
const syncSongArtists = async (db: DatabaseOrTransaction, songId: string, artistIds: string[]) => {
  await db.delete(songArtists).where(eq(songArtists.songId, songId));
  if (artistIds.length === 0) return;

  await db.insert(songArtists).values(
    artistIds.map((artistId) => ({
      songId,
      artistId,
      isGuest: false,
    })),
  );
};

export const createSongFull = async (
  db: DatabaseOrTransaction,
  { values, artistIds }: { values: SongCreateDbValues; artistIds: string[] },
) => {
  const { genreNames, artists: _, ...songValues } = values;

  const rows = await db.insert(songs).values(songValues).returning(songColumns);
  const [song] = rows;
  if (!song) return null;

  await syncSongArtists(db, song.id, artistIds);
  await syncSongGenres(db, song.id, genreNames);

  return song;
};

export const updateSongFull = async (
  db: DatabaseOrTransaction,
  { id, values, artistIds }: { id: string; values: SongCreateDbValues; artistIds: string[] },
) => {
  const { genreNames, artists: _, ...songValues } = values;

  const rows = await db
    .update(songs)
    .set({
      title: songValues.title,
      length: songValues.length,
      isrcs: songValues.isrcs,
      updatedAt: sql`now()`,
    })
    .where(and(eq(songs.id, id), isNull(songs.deletedAt)))
    .returning(songColumns);
  const song = rows[0] ?? null;
  if (!song) return null;

  await syncSongArtists(db, id, artistIds);
  await syncSongGenres(db, id, genreNames);

  return song;
};

export const findSongById = async (db: DatabaseOrTransaction, id: string) => {
  const rows = await db
    .select(songColumns)
    .from(songs)
    .where(and(eq(songs.id, id), isNull(songs.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
};

export const findOrCreateArtist = async (
  db: DatabaseOrTransaction,
  { appleMusicId, name }: { appleMusicId: string; name: string },
) => {
  const rows = await db
    .insert(artists)
    .values({ name, appleMusicId })
    .returning({ id: artists.id });
  return rows[0]?.id ?? null;
};

export const findActiveArtistByAppleMusicId = async (
  db: DatabaseOrTransaction,
  appleMusicId: string,
) => {
  const rows = await db
    .select({ id: artists.id })
    .from(artists)
    .where(and(eq(artists.appleMusicId, appleMusicId), isNull(artists.deletedAt)))
    .limit(1);
  return rows[0]?.id ?? null;
};
