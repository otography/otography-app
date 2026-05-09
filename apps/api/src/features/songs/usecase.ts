import { DbError, RlsError } from "@repo/errors";
import { createDb } from "../../shared/db";
import type { Cursor } from "../../shared/pagination";
import { buildPaginationMeta, normalizeLimit, trimItems } from "../../shared/pagination";
import { isPostgresUniqueViolation } from "../../shared/db/postgres-error";
import { withAnonymousRole, withAuthenticatedRole } from "../../shared/db/rls";
import { fetchSong, toSongInput } from "../../shared/apple-music";
import { findOrCreateArtists } from "../artists/repository";
import type { SongCreateBody } from "./model";
import { createSongFull, findSongById, listSongs, updateSongFull } from "./repository";

const SONG_APPLE_MUSIC_ID_KEY = "songs_apple_music_id_key";

const SONG_ALREADY_EXISTS_TYPE_URI = "https://api.otography.com/errors/song-already-exists";
const SONG_NOT_FOUND_TYPE_URI = "https://api.otography.com/errors/song-not-found";

const toSongAppleMusicIdError = (error: unknown, fallbackMessage: string) => {
  if (isPostgresUniqueViolation(error, SONG_APPLE_MUSIC_ID_KEY)) {
    return new DbError({
      message: "Apple Music ID is already registered for another song.",
      statusCode: 409,
      typeUri: SONG_ALREADY_EXISTS_TYPE_URI,
      cause: error,
    });
  }

  return new DbError({ message: fallbackMessage, cause: error });
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

export const getSongs = async (pagination?: { limit?: number; cursor?: Cursor | null }) => {
  const db = createDb();
  const limit = normalizeLimit(pagination?.limit);
  const rows = await withAnonymousRole(db, (tx) =>
    listSongs(tx, { limit, cursor: pagination?.cursor }),
  );
  if (rows instanceof Error) {
    return new DbError({ message: "Failed to fetch songs.", cause: rows });
  }

  const paginationMeta = buildPaginationMeta(rows, limit);
  const trimmed = trimItems(rows, limit);

  return { songs: trimmed, pagination: paginationMeta };
};

export const getSong = async (id: string) => {
  const db = createDb();
  const song = await withAnonymousRole(db, (tx) => findSongById(tx, id));
  if (song instanceof Error) {
    return new DbError({ message: "Failed to fetch song.", cause: song });
  }
  if (song === null) {
    return new DbError({
      message: "Song not found.",
      statusCode: 404,
      typeUri: SONG_NOT_FOUND_TYPE_URI,
    });
  }

  return { song };
};

export const registerSong = async (payload: SongCreateBody) => {
  const apiResponse = await fetchSong(payload.appleMusicId);
  if (apiResponse instanceof Error) return apiResponse;

  const input = toSongInput(apiResponse);
  if (input instanceof Error) return input;

  const db = createDb();
  const result = await withAuthenticatedRole(db, async (tx) => {
    const artistIds = await resolveArtistIds(tx, input.artistEntries);
    if (artistIds instanceof Error) return artistIds;

    return createSongFull(tx, {
      songValues: input.songValues,
      artistIds,
      genreNames: input.genreNames,
    });
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
    return new DbError({
      message: "Song not found.",
      statusCode: 404,
      typeUri: SONG_NOT_FOUND_TYPE_URI,
    });
  }

  // Apple Music API から再フェッチ
  const apiResponse = await fetchSong(existing.appleMusicId);
  if (apiResponse instanceof Error) return apiResponse;

  const input = toSongInput(apiResponse);
  if (input instanceof Error) return input;

  const result = await withAuthenticatedRole(db, async (tx) => {
    const artistIds = await resolveArtistIds(tx, input.artistEntries);
    if (artistIds instanceof Error) return artistIds;

    return updateSongFull(tx, {
      id,
      songValues: input.songValues,
      artistIds,
      genreNames: input.genreNames,
    });
  });

  if (result instanceof Error) return toDbError(result, "Failed to sync song.");
  if (result === null) {
    return new DbError({
      message: "Song not found.",
      statusCode: 404,
      typeUri: SONG_NOT_FOUND_TYPE_URI,
    });
  }

  return { song: result };
};
