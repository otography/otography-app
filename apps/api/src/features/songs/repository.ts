import { and, desc, eq, getColumns, inArray, isNull } from "drizzle-orm";
import type { DatabaseOrTransaction, DatabaseTransaction } from "../../shared/db";
import { cursorWhereClause, withPagination } from "../../shared/pagination";
import type { Cursor } from "../../shared/pagination";
import { genres, songArtists, songGenres, songs } from "../../shared/db/schema";
import type { SongDbValues } from "./model";

const { deletedAt: _, ...songColumns } = getColumns(songs);

export const listSongs = async (
  db: DatabaseOrTransaction,
  pagination?: { limit?: number; cursor?: Cursor | null },
) => {
  const { cursor } = pagination ?? {};
  const conditions = [isNull(songs.deletedAt)];

  if (cursor) {
    conditions.push(cursorWhereClause(songs.createdAt, songs.id, cursor));
  }

  return withPagination(
    db
      .select(songColumns)
      .from(songs)
      .where(and(...conditions))
      .orderBy(desc(songs.createdAt), desc(songs.id))
      .$dynamic(),
    pagination,
  );
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

// song_genres の紐付けを追加
const addSongGenres = async (db: DatabaseOrTransaction, songId: string, genreNames: string[]) => {
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

// song_genres の紐付けを全置換
const replaceSongGenres = async (
  db: DatabaseOrTransaction,
  songId: string,
  genreNames: string[],
) => {
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

// song_artists の紐付けを追加
const addSongArtists = async (db: DatabaseOrTransaction, songId: string, artistIds: string[]) => {
  if (artistIds.length === 0) return;

  await db.insert(songArtists).values(
    artistIds.map((artistId) => ({
      songId,
      artistId,
      isGuest: false,
    })),
  );
};

// song_artists の紐付けを全置換
const replaceSongArtists = async (
  db: DatabaseOrTransaction,
  songId: string,
  artistIds: string[],
) => {
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
  tx: DatabaseTransaction,
  {
    songValues,
    artistIds,
    genreNames,
  }: { songValues: SongDbValues; artistIds: string[]; genreNames: string[] },
) => {
  const rows = await tx.insert(songs).values(songValues).returning(songColumns);
  const [song] = rows;
  if (!song) return null;

  await addSongArtists(tx, song.id, artistIds);
  await addSongGenres(tx, song.id, genreNames);

  return song;
};

export const updateSongFull = async (
  tx: DatabaseTransaction,
  {
    id,
    songValues,
    artistIds,
    genreNames,
  }: { id: string; songValues: SongDbValues; artistIds: string[]; genreNames: string[] },
) => {
  const rows = await tx
    .update(songs)
    .set({
      title: songValues.title,
      length: songValues.length,
      isrcs: songValues.isrcs,
    })
    .where(and(eq(songs.id, id), isNull(songs.deletedAt)))
    .returning(songColumns);
  const song = rows[0] ?? null;
  if (!song) return null;

  await replaceSongArtists(tx, id, artistIds);
  await replaceSongGenres(tx, id, genreNames);

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

// appleMusicId で楽曲の存在確認（soft-deleted 除外、軽量）
export const songExistsByAppleMusicId = async (db: DatabaseOrTransaction, appleMusicId: string) => {
  const rows = await db
    .select({ id: songs.id })
    .from(songs)
    .where(and(eq(songs.appleMusicId, appleMusicId), isNull(songs.deletedAt)))
    .limit(1);
  return rows.length > 0;
};

// appleMusicId で楽曲を検索（soft-deleted 除外）
export const findSongByAppleMusicId = async (tx: DatabaseTransaction, appleMusicId: string) => {
  const rows = await tx
    .select(songColumns)
    .from(songs)
    .where(and(eq(songs.appleMusicId, appleMusicId), isNull(songs.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
};

// 楽曲を新規作成（Apple Music API から取得した情報を使用）
export const createSongFromAppleMusic = async (
  tx: DatabaseTransaction,
  appleMusicId: string,
  title: string,
  durationInMillis?: number,
  isrc?: string,
) => {
  return tx
    .insert(songs)
    .values({
      title,
      appleMusicId,
      length: durationInMillis != null ? Math.round(durationInMillis / 1000) : undefined,
      isrcs: isrc,
    })
    .onConflictDoUpdate({
      target: songs.appleMusicId,
      set: {
        title,
        deletedAt: null,
      },
    })
    .returning(songColumns);
};
