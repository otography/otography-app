import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { DbError } from "@repo/errors";
import { fetchSong, toSongInput } from "../../shared/apple-music";
import type { Database } from "../../shared/db";
import type { Cursor } from "../../shared/pagination";
import { toDbError } from "../../shared/db/postgres-error";
import { withRls } from "../../shared/db/rls";
import { findOrCreateArtists } from "../artists/repository";
import {
  createSongFull,
  findSongByAppleMusicId,
  songExistsByAppleMusicId,
} from "../songs/repository";
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

// レース検知用 sentinel: tx 内で楽曲が見つからず、事前 fetch もしていない場合に返す
const songMissingInTx = Symbol("song-missing-in-tx");

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

  let songInput: Exclude<ReturnType<typeof toSongInput>, Error> | null = null;
  if (!songExists) {
    const prepared = await prepareSongInput();
    if (prepared instanceof Error) return prepared;
    songInput = prepared;
  }

  // tx 本体をローカル関数化（リトライで再利用）
  const runTransaction = () =>
    withRls(db, session, async (tx, userId) => {
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

      // 存在チェック後に soft-delete されたレース
      if (!songInput) return songMissingInTx;

      const artistIds = await findOrCreateArtists(tx, songInput.artistEntries).catch((e) =>
        toDbError(e, "アーティストの解決に失敗しました。"),
      );
      if (artistIds instanceof Error) return artistIds;

      const song = await createSongFull(tx, {
        songValues: songInput.songValues,
        artistIds,
        genreNames: songInput.genreNames,
      });
      if (!song) {
        return new DbError({ message: "楽曲の作成に失敗しました。" });
      }

      const rows = await addFavoriteSong(tx, userId, song.id, {
        comment: input.comment,
        emoji: input.emoji,
        color: input.color,
      });
      if (rows instanceof Error) return rows;

      return rows[0] ?? null;
    });

  let result = await runTransaction();

  // レース検知時: トランザクション外で fetch → 1 回だけ再実行
  // createSongFull は onConflictDoUpdate(deletedAt: null) の冪等 upsert なので再実行時は解決する
  if (result === songMissingInTx) {
    const prepared = await prepareSongInput();
    if (prepared instanceof Error) return prepared;
    songInput = prepared;
    result = await runTransaction();
  }
  if (result === songMissingInTx) {
    // songInput を用意して再実行したため到達しない想定（型 narrowing のための防御的ガード）
    return new DbError({ message: "楽曲情報の取得に失敗しました。" });
  }

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
