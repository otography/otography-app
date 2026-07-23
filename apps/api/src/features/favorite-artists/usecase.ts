import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { DbError } from "@repo/errors";
import { and, eq, isNull } from "drizzle-orm";
import { fetchArtist } from "../../shared/apple-music";
import type { Database } from "../../shared/db";
import type { Cursor } from "../../shared/pagination";
import { artists } from "../../shared/db/schema";
import { toDbError } from "../../shared/db/postgres-error";
import { withRls } from "../../shared/db/rls";
import { findArtistByAppleMusicId, createArtistFromAppleMusic } from "../artists/repository";
import {
  addFavoriteArtist,
  removeFavoriteArtist,
  listFavoriteArtists,
  listFavoriteArtistsPublic,
} from "./repository";
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
    load: (page) => listFavoriteArtistsPublic(db, userId, page),
    errorMessage: "お気に入りアーティストの取得に失敗しました。",
    getFavoriteId: (row) => row.favorite.artistId,
    mapResource: (row) => ({ artist: row.artist }),
  });
};

// お気に入りアーティスト登録
export const registerFavoriteArtist = async (
  session: DecodedIdToken,
  input: AddFavoriteArtistInput,
  db: Database,
) => {
  // トランザクション外で DB を確認し、未登録なら事前に Apple Music API から取得
  const existing = await db
    .select({ id: artists.id })
    .from(artists)
    .where(and(eq(artists.appleMusicId, input.appleMusicId), isNull(artists.deletedAt)))
    .limit(1)
    .catch((e) => toDbError(e, "アーティストの検索に失敗しました。"));
  if (existing instanceof Error) return existing;

  let artistName: string | undefined;
  if (existing.length === 0) {
    const appleMusicArtist = await fetchArtist(input.appleMusicId);
    if (appleMusicArtist instanceof Error) return appleMusicArtist;
    artistName = appleMusicArtist.attributes.name;
  }

  // トランザクション内では DB 操作のみ
  const result = await withRls(db, session, async (tx, userId) => {
    let artistId: string;
    const found = await findArtistByAppleMusicId(tx, input.appleMusicId);
    if (found) {
      artistId = found.id;
    } else {
      if (!artistName) {
        return new DbError({
          message: "アーティスト情報の取得に失敗しました。",
        });
      }
      const created = await createArtistFromAppleMusic(tx, input.appleMusicId, artistName);
      if (!created[0]) {
        return new DbError({ message: "アーティストの作成に失敗しました。" });
      }
      artistId = created[0].id;
    }

    const rows = await addFavoriteArtist(tx, userId, artistId, {
      comment: input.comment,
      emoji: input.emoji,
      color: input.color,
    });
    if (rows instanceof Error) return rows;

    return rows[0] ?? null;
  });

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
