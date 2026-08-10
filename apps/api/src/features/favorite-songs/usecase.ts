import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { DbError } from "@repo/errors";
import { fetchSong, toSongInput } from "../../shared/apple-music";
import type { Database, DatabaseTransaction } from "../../shared/db";
import type { Cursor } from "../../shared/pagination";
import { toDbError } from "../../shared/db/postgres-error";
import { domainDbError } from "../../shared/errors/domain-error";
import { withRls } from "../../shared/db/rls";
import { findOrCreateArtists } from "../artists/apple-music-sync";
import {
  createSongFull,
  findSongByAppleMusicId,
  songExistsByAppleMusicId,
} from "../songs/repository";
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

// レース検知用 sentinel: tx 内で楽曲が見つからず、事前 fetch もしていない場合に返す
//
// 注: songs/usecase.ts の resolveOrCreateSong は同種の find-or-create ロジックを持つが、
// 内部のエラーメッセージが英語固定（"Failed to resolve artists." 等）でこの feature の
// 日本語メッセージ規約と噛み合わず、songs/usecase.ts はこのタスクの編集対象外のため
// メッセージを注入できない。振る舞い（エラーメッセージ）を変えないため直接の再利用は見送り、
// tx 内のロジックはこのファイルに残しつつ、リトライの制御フローのみ withRaceRetry として抽出した。
const songMissingInTx = Symbol("song-missing-in-tx");

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

// レースコンディションのリトライ制御を汎用化したヘルパー。
// attempt() が songMissingInTx を返したら recover() で不足していた状態（songInput）を
// 補完し、1 回だけ再実行する。recover() 自体が失敗した場合は「リトライ用データの準備に
// 失敗した」ことを示すため、通常の DB エラー正規化を経由せずそのまま呼び出し元へ返す
// （recovered: false）。attempt() の結果（成功/エラーいずれも）は呼び出し元での
// 正規化対象として扱う（recovered: true）。
const withRaceRetry = async <T>({
  attempt,
  recover,
  fallbackErrorMessage,
}: {
  attempt: () => Promise<T | typeof songMissingInTx>;
  recover: () => Promise<Error | void>;
  fallbackErrorMessage: string;
}): Promise<{ recovered: true; value: T } | { recovered: false; error: Error }> => {
  let result = await attempt();

  if (result === songMissingInTx) {
    const recoverResult = await recover();
    if (recoverResult instanceof Error) return { recovered: false, error: recoverResult };
    result = await attempt();
  }

  if (result === songMissingInTx) {
    // recover 後も解決しない想定外ケース（型 narrowing のための防御的ガード）
    return { recovered: false, error: new DbError({ message: fallbackErrorMessage }) };
  }

  return { recovered: true, value: result };
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

  let songInput: Exclude<ReturnType<typeof toSongInput>, Error> | null = null;
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
        const found = await findSongByAppleMusicId(tx, input.appleMusicId);
        if (found) {
          return insertFavoriteSong(tx, userId, found.id, favoriteValues);
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

        return insertFavoriteSong(tx, userId, song.id, favoriteValues);
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
