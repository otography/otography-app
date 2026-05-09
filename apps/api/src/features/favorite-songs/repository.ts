import { and, desc, eq, getColumns, isNull } from "drizzle-orm";
import { cursorWhereClause, withPagination } from "../../shared/pagination";
import type { Cursor } from "../../shared/pagination";
import { songs, favoriteSongs } from "../../shared/db/schema";
import type { DatabaseOrTransaction, DatabaseTransaction } from "../../shared/db";
import { toDbError } from "../../shared/db/postgres-error";
import { domainDbError } from "../../shared/errors/domain-error";
import type { FavoriteSongValues } from "./model";

const favoriteSongColumns = getColumns(favoriteSongs);

const songColumns = {
  id: songs.id,
  title: songs.title,
  appleMusicId: songs.appleMusicId,
} as const;

const createDuplicateFavoriteSongError = (cause?: unknown) =>
  domainDbError({
    slug: "favorite-song-already-exists",
    message: "この楽曲は既にお気に入りに登録されています。",
    cause,
  });

const toAddFavoriteSongError = (error: unknown) => {
  return toDbError(error, "お気に入り楽曲の登録に失敗しました。", {
    constraints: ["favorite_songs_pkey"],
  });
};

// お気に入り楽曲一覧取得（ページネーション対応）
export const listFavoriteSongs = async (
  tx: DatabaseTransaction,
  userId: string,
  pagination?: { limit?: number; cursor?: Cursor | null },
) => {
  const { cursor } = pagination ?? {};
  const conditions = [eq(favoriteSongs.userId, userId)];

  if (cursor) {
    conditions.push(cursorWhereClause(favoriteSongs.createdAt, favoriteSongs.songId, cursor));
  }

  return withPagination(
    tx
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
export const addFavoriteSong = async (
  tx: DatabaseTransaction,
  userId: string,
  songId: string,
  values: FavoriteSongValues,
) => {
  const result = await tx
    .insert(favoriteSongs)
    .values({
      userId,
      songId,
      ...values,
    })
    .onConflictDoNothing({
      target: [favoriteSongs.userId, favoriteSongs.songId],
    })
    .returning(favoriteSongColumns)
    .catch(toAddFavoriteSongError);

  if (!(result instanceof Error) && result.length === 0) {
    return createDuplicateFavoriteSongError();
  }

  return result;
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

// 他人のお気に入り楽曲一覧取得（RLS 不要、読み取り専用、ページネーション対応）
export const listFavoriteSongsPublic = async (
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
