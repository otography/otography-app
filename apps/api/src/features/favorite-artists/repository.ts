import { and, eq, isNull } from "drizzle-orm";
import { DbError } from "@repo/errors";
import { artists, favoriteArtists } from "../../shared/db/schema";
import type { DatabaseOrTransaction, DatabaseTransaction } from "../../shared/db";
import { isPostgresUniqueViolation } from "../../shared/db/postgres-error";
import type { FavoriteArtistValues } from "./model";

const favoriteArtistColumns = {
  userId: favoriteArtists.userId,
  artistId: favoriteArtists.artistId,
  comment: favoriteArtists.comment,
  emoji: favoriteArtists.emoji,
  color: favoriteArtists.color,
  createdAt: favoriteArtists.createdAt,
  updatedAt: favoriteArtists.updatedAt,
} as const;

const artistColumns = {
  id: artists.id,
  name: artists.name,
  appleMusicId: artists.appleMusicId,
} as const;

const toAddFavoriteArtistError = (error: unknown) => {
  if (isPostgresUniqueViolation(error, "favorite_artists_pkey")) {
    return new DbError({
      message: "このアーティストは既にお気に入りに登録されています。",
      statusCode: 409,
      cause: error,
    });
  }

  return new DbError({ message: "お気に入りアーティストの登録に失敗しました。", cause: error });
};

// お気に入りアーティスト一覧取得
export const listFavoriteArtists = async (tx: DatabaseTransaction, userId: string) => {
  return tx
    .select({
      favorite: favoriteArtistColumns,
      artist: artistColumns,
    })
    .from(favoriteArtists)
    .innerJoin(artists, and(eq(favoriteArtists.artistId, artists.id), isNull(artists.deletedAt)))
    .where(eq(favoriteArtists.userId, userId));
};

// お気に入りアーティスト登録
export const addFavoriteArtist = async (
  tx: DatabaseTransaction,
  userId: string,
  artistId: string,
  values: FavoriteArtistValues,
) => {
  const result = await tx
    .insert(favoriteArtists)
    .values({
      userId,
      artistId,
      ...values,
    })
    .returning(favoriteArtistColumns)
    .catch(toAddFavoriteArtistError);

  return result;
};

// お気に入りアーティスト削除（artistId 指定）
export const removeFavoriteArtist = async (
  tx: DatabaseTransaction,
  userId: string,
  artistId: string,
) => {
  return tx
    .delete(favoriteArtists)
    .where(and(eq(favoriteArtists.userId, userId), eq(favoriteArtists.artistId, artistId)))
    .returning({ artistId: favoriteArtists.artistId });
};

// 他人のお気に入りアーティスト一覧取得（RLS 不要、読み取り専用）
export const listFavoriteArtistsPublic = async (db: DatabaseOrTransaction, userId: string) => {
  return db
    .select({
      favorite: favoriteArtistColumns,
      artist: artistColumns,
    })
    .from(favoriteArtists)
    .innerJoin(artists, and(eq(favoriteArtists.artistId, artists.id), isNull(artists.deletedAt)))
    .where(eq(favoriteArtists.userId, userId));
};
