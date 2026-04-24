import { and, desc, eq, isNull } from "drizzle-orm";
import { createDb, type DatabaseTransaction } from "../../shared/db";
import { songs } from "../../shared/db/schema";
import type { SongCreateDbModel } from "./model";

const songColumns = {
  id: songs.id,
  title: songs.title,
  length: songs.length,
  isrcs: songs.isrcs,
  createdAt: songs.createdAt,
  updatedAt: songs.updatedAt,
} as const;

const listSongsTx = async (tx: DatabaseTransaction) => {
  return tx
    .select(songColumns)
    .from(songs)
    .where(isNull(songs.deletedAt))
    .orderBy(desc(songs.createdAt));
};

const createSongTx = async (tx: DatabaseTransaction, values: SongCreateDbModel) => {
  return tx.insert(songs).values(values).returning(songColumns);
};

const findSongByIdTx = async (tx: DatabaseTransaction, id: string) => {
  const rows = await tx
    .select(songColumns)
    .from(songs)
    .where(and(eq(songs.id, id), isNull(songs.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
};

export const listSongs = async () => {
  const db = createDb();
  return db.transaction((tx) => listSongsTx(tx)).catch(() => new Error("failed"));
};

export const createSong = async (values: SongCreateDbModel) => {
  const db = createDb();
  return db.transaction((tx) => createSongTx(tx, values)).catch(() => new Error("failed"));
};

export const findSongById = async (id: string) => {
  const db = createDb();
  return db.transaction((tx) => findSongByIdTx(tx, id)).catch(() => new Error("failed"));
};
