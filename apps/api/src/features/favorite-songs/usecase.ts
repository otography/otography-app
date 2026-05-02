import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { DbError } from "@repo/errors";
import { and, eq, isNull } from "drizzle-orm";
import { fetchSong } from "../../shared/apple-music";
import { createDb } from "../../shared/db";
import { songs } from "../../shared/db/schema";
import { withRls } from "../../shared/db/rls";
import {
  addFavoriteSong,
  removeFavoriteSongByAppleMusicId,
  findSongByAppleMusicId,
  createSongFromAppleMusic,
  listFavoriteSongs,
  listFavoriteSongsPublic,
} from "./repository";
import type { AddFavoriteSongInput } from "./model";

// お気に入り楽曲一覧取得
export const getFavoriteSongs = async (session: DecodedIdToken) => {
  const result = await withRls(session, async (tx, userId) => {
    return listFavoriteSongs(tx, userId);
  });

  if (result instanceof Error) {
    return new DbError({ message: "お気に入り楽曲の取得に失敗しました。", cause: result });
  }

  return {
    favorites: result.map((row) => ({
      song: row.song,
      comment: row.favorite.comment,
      emoji: row.favorite.emoji,
      color: row.favorite.color,
      addedAt: row.favorite.createdAt,
    })),
  };
};

// 他人のお気に入り楽曲一覧取得（RLS 不要）
export const getPublicFavoriteSongs = async (userId: string) => {
  const db = createDb();
  const result = await listFavoriteSongsPublic(db, userId).catch(
    (e) => new DbError({ message: "お気に入り楽曲の取得に失敗しました。", cause: e }),
  );
  if (result instanceof Error) return result;

  return {
    favorites: result.map((row) => ({
      song: row.song,
      comment: row.favorite.comment,
      emoji: row.favorite.emoji,
      color: row.favorite.color,
      addedAt: row.favorite.createdAt,
    })),
  };
};

// お気に入り楽曲登録
export const registerFavoriteSong = async (
  session: DecodedIdToken,
  input: AddFavoriteSongInput,
) => {
  // トランザクション外で DB を確認し、未登録なら事前に Apple Music API から取得
  const db = createDb();
  const existing = await db
    .select({ id: songs.id })
    .from(songs)
    .where(and(eq(songs.appleMusicId, input.appleMusicId), isNull(songs.deletedAt)))
    .limit(1)
    .catch((e) => new DbError({ message: "楽曲の検索に失敗しました。", cause: e }));
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
  const result = await withRls(session, async (tx, userId) => {
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
    return new DbError({
      message: "お気に入り楽曲の登録に失敗しました。",
      cause: result,
    });
  }

  if (!result) {
    return new DbError({ message: "お気に入り楽曲の登録に失敗しました。" });
  }

  return { favorite: result };
};

// お気に入り楽曲削除（appleMusicId 指定）
export const deleteFavoriteSong = async (session: DecodedIdToken, appleMusicId: string) => {
  const result = await withRls(session, async (tx, userId) => {
    return removeFavoriteSongByAppleMusicId(tx, userId, appleMusicId);
  });

  if (result instanceof Error) {
    return new DbError({
      message: "お気に入り楽曲の削除に失敗しました。",
      cause: result,
    });
  }

  if (result.length === 0) {
    return new DbError({
      message: "お気に入り楽曲が見つかりません。",
      statusCode: 404,
    });
  }

  return { deleted: true };
};
