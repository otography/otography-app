import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../shared/db";
import { songArtists, songs } from "../../shared/db/schema";
import type { SongCreateDbModel, SongUpdateDbModel } from "./model";

const songColumns = {
  id: songs.id,
  title: songs.title,
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

const createSong = async (db: DatabaseOrTransaction, values: SongCreateDbModel) => {
  return db.insert(songs).values(values).returning(songColumns);
};

export const createSongWithArtist = async (
  db: DatabaseOrTransaction,
  { values, artistId }: { values: SongCreateDbModel; artistId?: string },
) => {
  const rows = await createSong(db, values);
  const [song] = rows;
  if (!song) {
    return null;
  }

  if (artistId !== undefined) {
    await db.insert(songArtists).values({
      songId: song.id,
      artistId,
      isGuest: false,
    });
  }

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

export const updateSongById = async (
  db: DatabaseOrTransaction,
  {
    id,
    values,
    artistId,
  }: {
    id: string;
    values: SongUpdateDbModel;
    artistId?: string | null;
  },
) => {
  const rows = await db
    .update(songs)
    .set({
      ...values,
      updatedAt: sql`now()`,
    })
    .where(and(eq(songs.id, id), isNull(songs.deletedAt)))
    .returning(songColumns);
  const song = rows[0] ?? null;

  if (!song) {
    return null;
  }

  if (artistId !== undefined) {
    await db.delete(songArtists).where(eq(songArtists.songId, id));

    if (artistId !== null) {
      await db.insert(songArtists).values({
        songId: id,
        artistId,
        isGuest: false,
      });
    }
  }

  return song;
};
