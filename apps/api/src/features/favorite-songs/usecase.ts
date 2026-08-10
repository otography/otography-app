import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { DbError } from "@repo/errors";
import { fetchSong, toSongInput, type SongInput } from "../../shared/apple-music";
import {
  catalogEntityMissingInTx,
  resolveSongInTx,
  withRaceRetry,
} from "../../shared/apple-music-catalog";
import type { Database, DatabaseTransaction } from "../../shared/db";
import type { Cursor } from "../../shared/pagination";
import { toDbError } from "../../shared/db/postgres-error";
import { domainDbError } from "../../shared/errors/domain-error";
import { withRls } from "../../shared/db/rls";
import { findSongByAppleMusicId, songExistsByAppleMusicId } from "../songs/repository";
import { addFavoriteSong, removeFavoriteSong, listFavoriteSongs } from "./repository";
import type { AddFavoriteSongInput, FavoriteSongValues } from "./model";
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
    load: (page) => listFavoriteSongs(db, userId, page),
    errorMessage: "お気に入り楽曲の取得に失敗しました。",
    getFavoriteId: (row) => row.favorite.songId,
    mapResource: (row) => ({ song: row.song }),
  });
};

const FAVORITE_SONG_PKEY = "favorite_songs_pkey";

// 重複お気に入り登録エラー（onConflictDoNothing により行が挿入されなかった場合に生成）
const createDuplicateFavoriteSongError = (cause?: unknown) =>
  domainDbError({
    slug: "favorite-song-already-exists",
    message: "この楽曲は既にお気に入りに登録されています。",
    cause,
  });

// insert 時に postgres 側で制約違反が発生した場合の DbError 正規化。
// favorite-artists と重複検知戦略を統一: onConflictDoNothing を主戦略とし、
// 稀に onConflictDoNothing 対象外の理由で例外が飛んできた場合の保険として使う。
const toAddFavoriteSongError = (error: unknown) =>
  toDbError(error, "お気に入り楽曲の登録に失敗しました。", {
    constraints: [FAVORITE_SONG_PKEY],
  });

// お気に入り行を挿入し、重複時はドメインエラーに変換する（tx 内の2箇所から共用）
const insertFavoriteSong = async (
  tx: DatabaseTransaction,
  userId: string,
  songId: string,
  values: FavoriteSongValues,
) => {
  const rows = await addFavoriteSong(tx, userId, songId, values).catch(toAddFavoriteSongError);
  if (rows instanceof Error) return rows;
  if (rows.length === 0) return createDuplicateFavoriteSongError();

  return rows[0] ?? null;
};

// お気に入り楽曲登録
export const registerFavoriteSong = async (
  session: DecodedIdToken,
  input: AddFavoriteSongInput,
  db: Database,
) => {
  // トランザクション外で曲存在チェック（不要なAPI呼び出しを回避）
  const songExists = await songExistsByAppleMusicId(db, input.appleMusicId).catch((e) =>
    toDbError(e, "楽曲の検索に失敗しました。"),
  );
  if (songExists instanceof Error) return songExists;

  // Apple Music から取得して songInput を組み立てる（初回・リトライで共用）
  const prepareSongInput = async () => {
    const apiResponse = await fetchSong(input.appleMusicId);
    if (apiResponse instanceof Error) return apiResponse;
    return toSongInput(apiResponse);
  };

  let songInput: SongInput | null = null;
  if (!songExists) {
    const prepared = await prepareSongInput();
    if (prepared instanceof Error) return prepared;
    songInput = prepared;
  }

  const favoriteValues: FavoriteSongValues = {
    comment: input.comment,
    emoji: input.emoji,
    color: input.color,
  };

  const outcome = await withRaceRetry({
    attempt: () =>
      withRls(db, session, async (tx, userId) => {
        const resolved = await resolveSongInTx(tx, input.appleMusicId, songInput);
        if (resolved === catalogEntityMissingInTx) return catalogEntityMissingInTx;
        if (resolved instanceof Error) return resolved;

        return insertFavoriteSong(tx, userId, resolved.songId, favoriteValues);
      }),
    // createSongFull は onConflictDoUpdate(deletedAt: null) の冪等 upsert なので再実行時は解決する
    recover: async () => {
      const prepared = await prepareSongInput();
      if (prepared instanceof Error) return prepared;
      songInput = prepared;
    },
    fallbackErrorMessage: "楽曲情報の取得に失敗しました。",
  });

  if (!outcome.recovered) return outcome.error;
  const result = outcome.value;

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
