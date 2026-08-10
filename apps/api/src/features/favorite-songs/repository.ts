import { and, desc, eq, getColumns, isNull } from "drizzle-orm";
import { cursorWhereClause, withPagination } from "../../shared/pagination";
import type { Cursor } from "../../shared/pagination";
import { songs, favoriteSongs } from "../../shared/db/schema";
import type { DatabaseOrTransaction, DatabaseTransaction } from "../../shared/db";
import type { FavoriteSongValues } from "./model";

const favoriteSongColumns = getColumns(favoriteSongs);

const songColumns = {
  id: songs.id,
  title: songs.title,
  appleMusicId: songs.appleMusicId,
} as const;

// お気に入り楽曲一覧取得（ページネーション対応）
// private/public でクエリ内容は同一のため、tx/db いずれも受け取れるようにしている
export const listFavoriteSongs = async (
  db: DatabaseOrTransaction,
  userId: string,
  pagination?: { limit?: number; cursor?: Cursor | null },
) => {
  const { cursor } = pagination ?? {};
  const conditions = [eq(favoriteSongs.userId, userId)];

  if (cursor) {
    conditions.push(cursorWhereClause(favoriteSongs.createdAt, favoriteSongs.songId, cursor));
  }

  return withPagination(
    db
      .select({
        favorite: favoriteSongColumns,
        song: songColumns,
      })
      .from(favoriteSongs)
      .innerJoin(songs, and(eq(favoriteSongs.songId, songs.id), isNull(songs.deletedAt)))
      .where(and(...conditions))
      .orderBy(desc(favoriteSongs.createdAt), desc(favoriteSongs.songId))
      .$dynamic(),
    pagination,
  );
};

// お気に入り楽曲登録
// 重複時は onConflictDoNothing により空配列を返す（エラー正規化は usecase 層の責務）
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
    .onConflictDoNothing({
      target: [favoriteSongs.userId, favoriteSongs.songId],
    })
    .returning(favoriteSongColumns);
};

// お気に入り楽曲削除（songId 指定）
export const removeFavoriteSong = async (
  tx: DatabaseTransaction,
  userId: string,
  songId: string,
) => {
  return tx
    .delete(favoriteSongs)
    .where(and(eq(favoriteSongs.userId, userId), eq(favoriteSongs.songId, songId)))
    .returning({ songId: favoriteSongs.songId });
};
