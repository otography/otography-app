import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { DbError } from "@repo/errors";
import { and, eq, isNull } from "drizzle-orm";
import { fetchSong } from "../../shared/apple-music";
import type { Database } from "../../shared/db";
import type { Cursor } from "../../shared/pagination";
import { songs } from "../../shared/db/schema";
import { toDbError } from "../../shared/db/postgres-error";
import { withRls } from "../../shared/db/rls";
import { findSongByAppleMusicId, createSongFromAppleMusic } from "../songs/repository";
import {
  addFavoriteSong,
  removeFavoriteSong,
  listFavoriteSongs,
  listFavoriteSongsPublic,
} from "./repository";
import type { AddFavoriteSongInput } from "./model";
import { deleteFavorite, getFavoritePage } from "../favorites/usecase";

// お気に入り楽曲一覧取得
export const getFavoriteSongs = async (
  session: DecodedIdToken,
  db: Database,
  pagination?: { limit?: number; cursor?: Cursor | null },
) => {
  return getFavoritePage({
    pagination,
    load: (page) => withRls(db, session, (tx, userId) => listFavoriteSongs(tx, userId, page)),
    errorMessage: "お気に入り楽曲の取得に失敗しました。",
    getFavoriteId: (row) => row.favorite.songId,
    mapResource: (row) => ({ song: row.song }),
  });
};

// 他人のお気に入り楽曲一覧取得（RLS 不要）
export const getPublicFavoriteSongs = async (
  userId: string,
  db: Database,
  pagination?: { limit?: number; cursor?: Cursor | null },
) => {
  return getFavoritePage({
    pagination,
    load: (page) => listFavoriteSongsPublic(db, userId, page),
    errorMessage: "お気に入り楽曲の取得に失敗しました。",
    getFavoriteId: (row) => row.favorite.songId,
    mapResource: (row) => ({ song: row.song }),
  });
};

// お気に入り楽曲登録
export const registerFavoriteSong = async (
  session: DecodedIdToken,
  input: AddFavoriteSongInput,
  db: Database,
) => {
  // トランザクション外で DB を確認し、未登録なら事前に Apple Music API から取得
  const existing = await db
    .select({ id: songs.id })
    .from(songs)
    .where(and(eq(songs.appleMusicId, input.appleMusicId), isNull(songs.deletedAt)))
    .limit(1)
    .catch((e) => toDbError(e, "楽曲の検索に失敗しました。"));
  if (existing instanceof Error) return existing;

  const songData = await (async () => {
    if (existing.length > 0) return null;

    const appleMusicSong = await fetchSong(input.appleMusicId);
    if (appleMusicSong instanceof Error) return appleMusicSong;

    return {
      title: appleMusicSong.attributes.name,
      durationInMillis: appleMusicSong.attributes.durationInMillis,
      isrc: appleMusicSong.attributes.isrc,
    };
  })();
  if (songData instanceof Error) return songData;

  // トランザクション内では DB 操作のみ
  const result = await withRls(db, session, async (tx, userId) => {
    const found = await findSongByAppleMusicId(tx, input.appleMusicId);
    if (found) {
      const rows = await addFavoriteSong(tx, userId, found.id, {
        comment: input.comment,
        emoji: input.emoji,
        color: input.color,
      });
      if (rows instanceof Error) return rows;

      return rows[0] ?? null;
    }

    if (!songData) {
      return new DbError({
        message: "楽曲情報の取得に失敗しました。",
      });
    }

    const created = await createSongFromAppleMusic(
      tx,
      input.appleMusicId,
      songData.title,
      songData.durationInMillis,
      songData.isrc,
    );
    if (!created[0]) {
      return new DbError({ message: "楽曲の作成に失敗しました。" });
    }

    const rows = await addFavoriteSong(tx, userId, created[0].id, {
      comment: input.comment,
      emoji: input.emoji,
      color: input.color,
    });
    if (rows instanceof Error) return rows;

    return rows[0] ?? null;
  });

  if (result instanceof Error) {
    if (result instanceof DbError && result.statusCode !== 500) return result;
    return toDbError(result, "お気に入り楽曲の登録に失敗しました。");
  }

  if (!result) {
    return new DbError({ message: "お気に入り楽曲の登録に失敗しました。" });
  }

  return { favorite: result };
};

// お気に入り楽曲削除（appleMusicId 指定）
export const deleteFavoriteSong = async (
  session: DecodedIdToken,
  appleMusicId: string,
  db: Database,
) => {
  return deleteFavorite({
    session,
    appleMusicId,
    db,
    findResource: findSongByAppleMusicId,
    remove: removeFavoriteSong,
    errorMessage: "お気に入り楽曲の削除に失敗しました。",
    notFoundMessage: "お気に入り楽曲が見つかりません。",
  });
};
