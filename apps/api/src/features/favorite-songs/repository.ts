import { and, eq, isNull } from "drizzle-orm";
import { songs, favoriteSongs } from "../../shared/db/schema";
import type { DatabaseOrTransaction, DatabaseTransaction } from "../../shared/db";
import type { FavoriteSongValues } from "./model";

const favoriteSongColumns = {
  userId: favoriteSongs.userId,
  songId: favoriteSongs.songId,
  comment: favoriteSongs.comment,
  emoji: favoriteSongs.emoji,
  color: favoriteSongs.color,
  createdAt: favoriteSongs.createdAt,
} as const;

const songColumns = {
  id: songs.id,
  title: songs.title,
  appleMusicId: songs.appleMusicId,
} as const;

// お気に入り楽曲一覧取得
export const listFavoriteSongs = async (tx: DatabaseTransaction, userId: string) => {
  return tx
    .select({
      favorite: favoriteSongColumns,
      song: songColumns,
    })
    .from(favoriteSongs)
    .innerJoin(songs, and(eq(favoriteSongs.songId, songs.id), isNull(songs.deletedAt)))
    .where(eq(favoriteSongs.userId, userId));
};

// お気に入り楽曲登録
export const addFavoriteSong = async (
  tx: DatabaseTransaction,
  userId: string,
  songId: string,
  values: FavoriteSongValues,
) => {
  return tx
    .insert(favoriteSongs)
    .values({
      userId,
      songId,
      ...values,
    })
    .returning(favoriteSongColumns);
};

// お気に入り楽曲削除（appleMusicId 指定）
export const removeFavoriteSongByAppleMusicId = async (
  tx: DatabaseTransaction,
  userId: string,
  appleMusicId: string,
) => {
  const song = await findSongByAppleMusicId(tx, appleMusicId);
  if (!song) return [];

  return tx
    .delete(favoriteSongs)
    .where(and(eq(favoriteSongs.userId, userId), eq(favoriteSongs.songId, song.id)))
    .returning({ songId: favoriteSongs.songId });
};

// 他人のお気に入り楽曲一覧取得（RLS 不要、読み取り専用）
export const listFavoriteSongsPublic = async (db: DatabaseOrTransaction, userId: string) => {
  return db
    .select({
      favorite: favoriteSongColumns,
      song: songColumns,
    })
    .from(favoriteSongs)
    .innerJoin(songs, and(eq(favoriteSongs.songId, songs.id), isNull(songs.deletedAt)))
    .where(eq(favoriteSongs.userId, userId));
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
