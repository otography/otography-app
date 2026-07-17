import { DbError, RlsError } from "@repo/errors";
import type { Database } from "../../shared/db";
import type { Cursor } from "../../shared/pagination";
import { buildPaginationMeta, normalizeLimit, trimItems } from "../../shared/pagination";
import { toDbError } from "../../shared/db/postgres-error";
import { withAnonymousRole, withAuthenticatedRole } from "../../shared/db/rls";
import { fetchArtist } from "../../shared/apple-music";
import { domainDbError } from "../../shared/errors/domain-error";
import { type ArtistCreateBody, type ArtistCreateDbValues } from "./model";
import { createArtist, findArtistById, listArtists, updateArtistById } from "./repository";

const ARTIST_APPLE_MUSIC_ID_KEY = "artists_apple_music_id_key";

const toArtistAppleMusicIdError = (error: unknown, fallbackMessage: string) => {
  return toDbError(error, fallbackMessage, {
    constraints: [ARTIST_APPLE_MUSIC_ID_KEY],
  });
};

// withAuthenticatedRole / withAnonymousRole はエラーを RlsError として返す（throw しない）。
// 結果を DbError に変換するヘルパー。cause チェーンから unique violation を検出する。
const normalizeArtistDbError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof DbError) return error;
  if (error instanceof RlsError) {
    return toArtistAppleMusicIdError(error.cause, fallbackMessage);
  }
  return toArtistAppleMusicIdError(error, fallbackMessage);
};

export const getArtists = async (
  pagination: { limit?: number; cursor?: Cursor | null } | undefined,
  db: Database,
) => {
  const limit = normalizeLimit(pagination?.limit);
  const rows = await withAnonymousRole(db, (tx) =>
    listArtists(tx, { limit, cursor: pagination?.cursor }),
  );
  if (rows instanceof Error) {
    return toDbError(rows, "Failed to fetch artists.");
  }

  const paginationMeta = buildPaginationMeta(rows, limit);
  const trimmed = trimItems(rows, limit);

  return { artists: trimmed, pagination: paginationMeta };
};

export const getArtist = async (id: string, db: Database) => {
  const artist = await withAnonymousRole(db, (tx) => findArtistById(tx, id));
  if (artist instanceof Error) {
    return toDbError(artist, "Failed to fetch artist.");
  }
  if (artist === null) {
    return domainDbError({
      slug: "artist-not-found",
      message: "Artist not found.",
    });
  }

  return { artist };
};

export const registerArtist = async (payload: ArtistCreateBody, db: Database) => {
  const apiResponse = await fetchArtist(payload.appleMusicId);
  if (apiResponse instanceof Error) return apiResponse;

  const dbValues: ArtistCreateDbValues = {
    name: apiResponse.attributes.name,
    appleMusicId: apiResponse.id,
    ipiCode: null,
    gender: null,
    birthdate: null,
  };

  const result = await withAuthenticatedRole(db, (tx) => createArtist(tx, dbValues));
  if (result instanceof Error) return normalizeArtistDbError(result, "Failed to create artist.");

  const [artist] = result;
  if (!artist) {
    return new DbError({ message: "Failed to create artist." });
  }

  return { artist };
};

export const syncArtist = async (id: string, db: Database) => {
  // 既存アーティストを取得（anon で可）
  const existing = await withAnonymousRole(db, (tx) => findArtistById(tx, id));
  if (existing instanceof Error) {
    return toDbError(existing, "Failed to fetch artist.");
  }
  if (existing === null) {
    return domainDbError({
      slug: "artist-not-found",
      message: "Artist not found.",
    });
  }

  // Apple Music API から再フェッチ（クライアント入力ではなく既存行の appleMusicId を使用）
  const apiResponse = await fetchArtist(existing.appleMusicId);
  if (apiResponse instanceof Error) return apiResponse;

  const result = await withAuthenticatedRole(db, (tx) =>
    updateArtistById(tx, { id, values: { name: apiResponse.attributes.name } }),
  );
  if (result instanceof Error) return normalizeArtistDbError(result, "Failed to sync artist.");
  if (result === null) {
    return domainDbError({
      slug: "artist-not-found",
      message: "Artist not found.",
    });
  }

  return { artist: result };
};
