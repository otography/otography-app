import { DbError, RlsError } from "@repo/errors";
import { createDb } from "../../shared/db";
import { isPostgresUniqueViolation } from "../../shared/db/postgres-error";
import { withAnonymousRole, withAuthenticatedRole } from "../../shared/db/rls";
import { fetchSong } from "../../shared/apple-music";
import type { SongCreateBody } from "./model";
import {
  createSongFull,
  findOrCreateArtists,
  findSongById,
  listSongs,
  updateSongFull,
} from "./repository";

const SONG_APPLE_MUSIC_ID_KEY = "songs_apple_music_id_key";

const toSongAppleMusicIdError = (error: unknown, fallbackMessage: string) => {
  if (isPostgresUniqueViolation(error, SONG_APPLE_MUSIC_ID_KEY)) {
    return new DbError({
      message: "Apple Music ID is already registered for another song.",
      statusCode: 409,
      cause: error,
    });
  }

  return new DbError({ message: fallbackMessage, cause: error });
};

// Apple Music API レスポンスからDB挿入値を構築
const toSongDbValues = (apiResponse: Awaited<ReturnType<typeof fetchSong>>) => {
  if (apiResponse instanceof Error) return apiResponse;

  const { attributes, relationships } = apiResponse;
  const artists =
    relationships?.artists?.data?.map((a) => ({
      appleMusicId: a.id,
      name: a.attributes?.name ?? "",
    })) ?? [];

  return {
    title: attributes.name,
    appleMusicId: apiResponse.id,
    length:
      attributes.durationInMillis != null ? Math.round(attributes.durationInMillis / 1000) : null,
    isrcs: attributes.isrc ?? null,
    genreNames: attributes.genreNames,
    artists,
  };
};

// アーティストをバッチで find-or-create
const resolveArtistIds = async (
  db: import("../../shared/db").DatabaseOrTransaction,
  artists: { appleMusicId: string; name: string }[],
): Promise<string[] | DbError> => {
  return findOrCreateArtists(db, artists).catch(
    (e) => new DbError({ message: "Failed to resolve artists.", cause: e }),
  );
};

// withAuthenticatedRole / withAnonymousRole はエラーを RlsError として返す（throw しない）。
// 結果を DbError に変換するヘルパー。cause チェーンから unique violation を検出する。
const toDbError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof DbError) return error;
  if (error instanceof RlsError) {
    return toSongAppleMusicIdError(error.cause, fallbackMessage);
  }
  return new DbError({ message: fallbackMessage, cause: error });
};

export const getSongs = async () => {
  const db = createDb();
  const rows = await withAnonymousRole(db, (tx) => listSongs(tx));
  if (rows instanceof Error) {
    return new DbError({ message: "Failed to fetch songs.", cause: rows });
  }

  return { songs: rows };
};

export const getSong = async (id: string) => {
  const db = createDb();
  const song = await withAnonymousRole(db, (tx) => findSongById(tx, id));
  if (song instanceof Error) {
    return new DbError({ message: "Failed to fetch song.", cause: song });
  }
  if (song === null) {
    return new DbError({ message: "Song not found.", statusCode: 404 });
  }

  return { song };
};

export const registerSong = async (payload: SongCreateBody) => {
  const apiResponse = await fetchSong(payload.appleMusicId);
  if (apiResponse instanceof Error) return apiResponse;

  const dbValues = toSongDbValues(apiResponse);
  if (dbValues instanceof Error) return dbValues;

  const db = createDb();
  const result = await withAuthenticatedRole(db, async (tx) => {
    const artistIds = await resolveArtistIds(tx, dbValues.artists);
    if (artistIds instanceof Error) return artistIds;

    return createSongFull(tx, { values: dbValues, artistIds });
  });
  if (result instanceof Error) return toDbError(result, "Failed to create song.");
  if (!result) {
    return new DbError({ message: "Failed to create song." });
  }

  return { song: result };
};

export const syncSong = async (id: string) => {
  // 既存曲を取得（anon で可）
  const db = createDb();
  const existing = await withAnonymousRole(db, (tx) => findSongById(tx, id));
  if (existing instanceof Error) {
    return new DbError({ message: "Failed to fetch song.", cause: existing });
  }
  if (existing === null) {
    return new DbError({ message: "Song not found.", statusCode: 404 });
  }

  // Apple Music API から再フェッチ
  const apiResponse = await fetchSong(existing.appleMusicId);
  if (apiResponse instanceof Error) return apiResponse;

  const dbValues = toSongDbValues(apiResponse);
  if (dbValues instanceof Error) return dbValues;

  const result = await withAuthenticatedRole(db, async (tx) => {
    const artistIds = await resolveArtistIds(tx, dbValues.artists);
    if (artistIds instanceof Error) return artistIds;

    return updateSongFull(tx, { id, values: dbValues, artistIds });
  });

  if (result instanceof Error) return toDbError(result, "Failed to sync song.");
  if (result === null) {
    return new DbError({ message: "Song not found.", statusCode: 404 });
  }

  return { song: result };
};
