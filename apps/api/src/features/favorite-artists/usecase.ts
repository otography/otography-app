import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { DbError } from "@repo/errors";
import { fetchArtist, toArtistInput, type ArtistInput } from "../../shared/apple-music";
import {
  catalogEntityMissingInTx,
  resolveArtistInTx,
  withRaceRetry,
} from "../../shared/apple-music-catalog";
import type { Database } from "../../shared/db";
import type { Cursor } from "../../shared/pagination";
import { toDbError } from "../../shared/db/postgres-error";
import { domainDbError } from "../../shared/errors/domain-error";
import { withRls } from "../../shared/db/rls";
import { artistExistsByAppleMusicId, findArtistByAppleMusicId } from "../artists/repository";
import { addFavoriteArtist, removeFavoriteArtist, listFavoriteArtists } from "./repository";
import type { AddFavoriteArtistInput } from "./model";
import { deleteFavorite, getFavoritePage } from "../favorites/usecase";

// お気に入りアーティスト一覧取得
export const getFavoriteArtists = async (
  session: DecodedIdToken,
  db: Database,
  pagination?: { limit?: number; cursor?: Cursor | null },
) => {
  return getFavoritePage({
    pagination,
    load: (page) => withRls(db, session, (tx, userId) => listFavoriteArtists(tx, userId, page)),
    errorMessage: "お気に入りアーティストの取得に失敗しました。",
    getFavoriteId: (row) => row.favorite.artistId,
    mapResource: (row) => ({ artist: row.artist }),
  });
};

// 他人のお気に入りアーティスト一覧取得（RLS 不要）
export const getPublicFavoriteArtists = async (
  userId: string,
  db: Database,
  pagination?: { limit?: number; cursor?: Cursor | null },
) => {
  return getFavoritePage({
    pagination,
    load: (page) => listFavoriteArtists(db, userId, page),
    errorMessage: "お気に入りアーティストの取得に失敗しました。",
    getFavoriteId: (row) => row.favorite.artistId,
    mapResource: (row) => ({ artist: row.artist }),
  });
};

const FAVORITE_ARTIST_PKEY = "favorite_artists_pkey";

// 重複お気に入り登録エラー（onConflictDoNothing により行が挿入されなかった場合に生成）
const createDuplicateFavoriteArtistError = (cause?: unknown) =>
  domainDbError({
    slug: "favorite-artist-already-exists",
    message: "このアーティストは既にお気に入りに登録されています。",
    cause,
  });

// insert 時に postgres 側で制約違反が発生した場合の DbError 正規化。
// favorite-songs と重複検知戦略を統一: onConflictDoNothing を主戦略とし、
// 稀に onConflictDoNothing 対象外の理由で例外が飛んできた場合の保険として使う。
const toAddFavoriteArtistError = (error: unknown) =>
  toDbError(error, "お気に入りアーティストの登録に失敗しました。", {
    constraints: [FAVORITE_ARTIST_PKEY],
  });

// お気に入りアーティスト登録
export const registerFavoriteArtist = async (
  session: DecodedIdToken,
  input: AddFavoriteArtistInput,
  db: Database,
) => {
  // トランザクション外で DB を確認し、未登録なら事前に Apple Music API から取得
  const exists = await artistExistsByAppleMusicId(db, input.appleMusicId).catch((e) =>
    toDbError(e, "アーティストの検索に失敗しました。"),
  );
  if (exists instanceof Error) return exists;

  // Apple Music から取得して artistInput を組み立てる（初回・リトライで共用）
  const prepareArtistInput = async () => {
    const appleMusicArtist = await fetchArtist(input.appleMusicId);
    if (appleMusicArtist instanceof Error) return appleMusicArtist;
    return toArtistInput(appleMusicArtist);
  };

  let artistInput: ArtistInput | null = null;
  if (!exists) {
    const prepared = await prepareArtistInput();
    if (prepared instanceof Error) return prepared;
    artistInput = prepared;
  }

  const outcome = await withRaceRetry({
    attempt: () =>
      withRls(db, session, async (tx, userId) => {
        const resolved = await resolveArtistInTx(tx, input.appleMusicId, artistInput);
        if (resolved === catalogEntityMissingInTx) return catalogEntityMissingInTx;
        if (resolved instanceof Error) return resolved;

        const rows = await addFavoriteArtist(tx, userId, resolved.artistId, {
          comment: input.comment,
          emoji: input.emoji,
          color: input.color,
        }).catch(toAddFavoriteArtistError);
        if (rows instanceof Error) return rows;
        if (rows.length === 0) return createDuplicateFavoriteArtistError();

        return rows[0] ?? null;
      }),
    // createArtistFromAppleMusic は onConflictDoUpdate(deletedAt: null) の冪等 upsert なので再実行時は解決する
    recover: async () => {
      const prepared = await prepareArtistInput();
      if (prepared instanceof Error) return prepared;
      artistInput = prepared;
    },
    fallbackErrorMessage: "アーティスト情報の取得に失敗しました。",
  });

  if (!outcome.recovered) return outcome.error;
  const result = outcome.value;

  if (result instanceof Error) {
    if (result instanceof DbError && result.statusCode !== 500) return result;
    return toDbError(result, "お気に入りアーティストの登録に失敗しました。");
  }

  if (!result) {
    return new DbError({ message: "お気に入りアーティストの登録に失敗しました。" });
  }

  return { favorite: result };
};

// お気に入りアーティスト削除（appleMusicId 指定）
export const deleteFavoriteArtist = async (
  session: DecodedIdToken,
  appleMusicId: string,
  db: Database,
) => {
  return deleteFavorite({
    session,
    appleMusicId,
    db,
    findResource: findArtistByAppleMusicId,
    remove: removeFavoriteArtist,
    errorMessage: "お気に入りアーティストの削除に失敗しました。",
    notFoundMessage: "お気に入りアーティストが見つかりません。",
  });
};
