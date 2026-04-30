import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { DbError } from "@repo/errors";
import { and, eq, isNull } from "drizzle-orm";
import { fetchArtist } from "../../shared/apple-music";
import { createDb } from "../../shared/db";
import { artists } from "../../shared/db/schema";
import { withRls } from "../../shared/db/rls";
import {
  addFavoriteArtist,
  removeFavoriteArtistByAppleMusicId,
  findArtistByAppleMusicId,
  createArtistFromAppleMusic,
  listFavoriteArtists,
  listFavoriteArtistsPublic,
} from "./repository";
import type { AddFavoriteArtistInput } from "./model";

// お気に入りアーティスト一覧取得
export const getFavoriteArtists = async (session: DecodedIdToken) => {
  const result = await withRls(session, async (tx, userId) => {
    return listFavoriteArtists(tx, userId);
  });

  if (result instanceof Error) {
    return new DbError({ message: "お気に入りアーティストの取得に失敗しました。", cause: result });
  }

  return {
    favorites: result.map((row) => ({
      artist: row.artist,
      comment: row.favorite.comment,
      emoji: row.favorite.emoji,
      color: row.favorite.color,
      addedAt: row.favorite.createdAt,
    })),
  };
};

// 他人のお気に入りアーティスト一覧取得（RLS 不要）
export const getPublicFavoriteArtists = async (userId: string) => {
  const db = createDb();
  const result = await listFavoriteArtistsPublic(db, userId).catch(
    (e) => new DbError({ message: "お気に入りアーティストの取得に失敗しました。", cause: e }),
  );
  if (result instanceof Error) return result;

  return {
    favorites: result.map((row) => ({
      artist: row.artist,
      comment: row.favorite.comment,
      emoji: row.favorite.emoji,
      color: row.favorite.color,
      addedAt: row.favorite.createdAt,
    })),
  };
};

// お気に入りアーティスト登録
export const registerFavoriteArtist = async (
  session: DecodedIdToken,
  input: AddFavoriteArtistInput,
) => {
  // トランザクション外で DB を確認し、未登録なら事前に Apple Music API から取得
  const db = createDb();
  const existing = await db
    .select({ id: artists.id })
    .from(artists)
    .where(and(eq(artists.appleMusicId, input.appleMusicId), isNull(artists.deletedAt)))
    .limit(1)
    .catch((e) => new DbError({ message: "アーティストの検索に失敗しました。", cause: e }));
  if (existing instanceof Error) return existing;

  let artistName: string | undefined;
  if (existing.length === 0) {
    const appleMusicArtist = await fetchArtist(input.appleMusicId);
    if (appleMusicArtist instanceof Error) return appleMusicArtist;
    artistName = appleMusicArtist.attributes.name;
  }

  // トランザクション内では DB 操作のみ
  const result = await withRls(session, async (tx, userId) => {
    let artistId: string;
    const found = await findArtistByAppleMusicId(tx, input.appleMusicId);
    if (found) {
      artistId = found.id;
    } else {
      if (!artistName) {
        throw new DbError({
          message: "アーティスト情報の取得に失敗しました。",
        });
      }
      const created = await createArtistFromAppleMusic(tx, input.appleMusicId, artistName);
      if (!created[0]) {
        throw new DbError({ message: "アーティストの作成に失敗しました。" });
      }
      artistId = created[0].id;
    }

    const rows = await addFavoriteArtist(tx, userId, artistId, {
      comment: input.comment,
      emoji: input.emoji,
      color: input.color,
    });

    return rows[0] ?? null;
  });

  if (result instanceof Error) {
    // favorite_artists の PK 制約違反（userId + artistId の重複）のみ 409 とする
    // artists.apple_music_id の unique 制約違反は別エラーとして扱う
    const causeStr = String(result.cause);
    if (
      result.cause &&
      causeStr.includes("23505") &&
      (causeStr.includes("favorite_artists") || causeStr.includes("FavoriteArtists"))
    ) {
      return new DbError({
        message: "このアーティストは既にお気に入りに登録されています。",
        statusCode: 409,
      });
    }
    return new DbError({
      message: "お気に入りアーティストの登録に失敗しました。",
      cause: result,
    });
  }

  if (!result) {
    return new DbError({ message: "お気に入りアーティストの登録に失敗しました。" });
  }

  return { favorite: result };
};

// お気に入りアーティスト削除（appleMusicId 指定）
export const deleteFavoriteArtist = async (session: DecodedIdToken, appleMusicId: string) => {
  const result = await withRls(session, async (tx, userId) => {
    return removeFavoriteArtistByAppleMusicId(tx, userId, appleMusicId);
  });

  if (result instanceof Error) {
    return new DbError({
      message: "お気に入りアーティストの削除に失敗しました。",
      cause: result,
    });
  }

  if (result.length === 0) {
    return new DbError({
      message: "お気に入りアーティストが見つかりません。",
      statusCode: 404,
    });
  }

  return { deleted: true };
};
