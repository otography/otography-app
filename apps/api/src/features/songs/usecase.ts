import { DbError, RlsError } from "@repo/errors";
import { createDb } from "../../shared/db";
import type { Cursor } from "../../shared/pagination";
import { buildPaginationMeta, normalizeLimit, trimItems } from "../../shared/pagination";
import { toDbError } from "../../shared/db/postgres-error";
import { withAnonymousRole, withAuthenticatedRole } from "../../shared/db/rls";
import { fetchSong, toSongInput } from "../../shared/apple-music";
import { domainDbError } from "../../shared/errors/domain-error";
import { findOrCreateArtists } from "../artists/repository";
import type { SongCreateBody } from "./model";
import { createSongFull, findSongById, listSongs, updateSongFull } from "./repository";

const SONG_APPLE_MUSIC_ID_KEY = "songs_apple_music_id_key";

const toSongAppleMusicIdError = (error: unknown, fallbackMessage: string) => {
  return toDbError(error, fallbackMessage, {
    constraints: [SONG_APPLE_MUSIC_ID_KEY],
  });
};

// アーティストをバッチで find-or-create
const resolveArtistIds = async (
  db: import("../../shared/db").DatabaseOrTransaction,
  artists: { appleMusicId: string; name: string }[],
): Promise<string[] | DbError> => {
  return findOrCreateArtists(db, artists).catch((e) => toDbError(e, "Failed to resolve artists."));
};

// withAuthenticatedRole / withAnonymousRole はエラーを RlsError として返す（throw しない）。
// 結果を DbError に変換するヘルパー。cause チェーンから unique violation を検出する。
const normalizeSongDbError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof DbError) return error;
  if (error instanceof RlsError) {
    return toSongAppleMusicIdError(error.cause, fallbackMessage);
  }
  return toSongAppleMusicIdError(error, fallbackMessage);
};

export const getSongs = async (pagination?: { limit?: number; cursor?: Cursor | null }) => {
  const db = createDb();
  const limit = normalizeLimit(pagination?.limit);
  const rows = await withAnonymousRole(db, (tx) =>
    listSongs(tx, { limit, cursor: pagination?.cursor }),
  );
  if (rows instanceof Error) {
    return toDbError(rows, "Failed to fetch songs.");
  }

  const paginationMeta = buildPaginationMeta(rows, limit);
  const trimmed = trimItems(rows, limit);

  return { songs: trimmed, pagination: paginationMeta };
};

export const getSong = async (id: string) => {
  const db = createDb();
  const song = await withAnonymousRole(db, (tx) => findSongById(tx, id));
  if (song instanceof Error) {
    return toDbError(song, "Failed to fetch song.");
  }
  if (song === null) {
    return domainDbError({
      slug: "song-not-found",
      message: "Song not found.",
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
  if (result instanceof Error) return normalizeSongDbError(result, "Failed to create song.");
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
    return toDbError(existing, "Failed to fetch song.");
  }
  if (existing === null) {
    return domainDbError({
      slug: "song-not-found",
      message: "Song not found.",
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

  if (result instanceof Error) return normalizeSongDbError(result, "Failed to sync song.");
  if (result === null) {
    return domainDbError({
      slug: "song-not-found",
      message: "Song not found.",
    });
  }

  return { song: result };
};
