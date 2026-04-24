import { and, desc, eq, isNull } from "drizzle-orm";
import { songs } from "../../shared/db/schema";
import type { DatabaseOrTransaction } from "../../shared/db";
import type { SongCreateDbModel } from "./model";

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

export const createSong = async (db: DatabaseOrTransaction, values: SongCreateDbModel) => {
  return db.insert(songs).values(values).returning(songColumns);
};

export const findSongById = async (db: DatabaseOrTransaction, id: string) => {
  const rows = await db
    .select(songColumns)
    .from(songs)
    .where(and(eq(songs.id, id), isNull(songs.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
};
