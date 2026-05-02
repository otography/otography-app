import { DbError } from "@repo/errors";
import { createDb, type DatabaseOrTransaction } from "../../shared/db";
import { isPostgresUniqueViolation } from "../../shared/db/postgres-error";
import { fetchSong } from "../../shared/apple-music";
import type { SongCreateBody } from "./model";
import {
  createSongFull,
  findActiveArtistByAppleMusicId,
  findOrCreateArtist,
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

// アーティストの find-or-create（未登録なら自動作成）
const resolveArtistIds = async (
  db: DatabaseOrTransaction,
  artists: { appleMusicId: string; name: string }[],
): Promise<string[] | DbError> => {
  const artistIds: string[] = [];
  for (const artist of artists) {
    if (!artist.name) continue;
    const result = await findActiveArtistByAppleMusicId(db, artist.appleMusicId).catch(
      (e) => new DbError({ message: "Failed to find artist.", cause: e }),
    );
    if (result instanceof Error) return result;
    if (result !== null) {
      artistIds.push(result);
    } else {
      // 未登録アーティストを自動作成
      const created = await findOrCreateArtist(db, artist).catch(
        (e) => new DbError({ message: "Failed to create artist.", cause: e }),
      );
      if (created instanceof Error) return created;
      if (created !== null) {
        artistIds.push(created);
      }
    }
  }
  return artistIds;
};

export const getSongs = async () => {
  const db = createDb();
  const rows = await listSongs(db).catch(
    (e) => new DbError({ message: "Failed to fetch songs.", cause: e }),
  );
  if (rows instanceof Error) return rows;

  return { songs: rows };
};

export const getSong = async (id: string) => {
  const db = createDb();
  const song = await findSongById(db, id).catch(
    (e) => new DbError({ message: "Failed to fetch song.", cause: e }),
  );
  if (song instanceof Error) return song;
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

  const song = await db
    .transaction(async (tx) => {
      const artistIds = await resolveArtistIds(tx, dbValues.artists);
      if (artistIds instanceof Error) throw artistIds;

      return createSongFull(tx, { values: dbValues, artistIds });
    })
    .catch((e) => {
      if (e instanceof DbError) return e;
      return toSongAppleMusicIdError(e, "Failed to create song.");
    });
  if (song instanceof Error) return song;
  if (!song) {
    return new DbError({ message: "Failed to create song." });
  }

  return { song };
};

export const syncSong = async (id: string) => {
  const db = createDb();

  // 既存曲を取得
  const existing = await findSongById(db, id).catch(
    (e) => new DbError({ message: "Failed to fetch song.", cause: e }),
  );
  if (existing instanceof Error) return existing;
  if (existing === null) {
    return new DbError({ message: "Song not found.", statusCode: 404 });
  }

  // Apple Music API から再フェッチ
  const apiResponse = await fetchSong(existing.appleMusicId);
  if (apiResponse instanceof Error) return apiResponse;

  const dbValues = toSongDbValues(apiResponse);
  if (dbValues instanceof Error) return dbValues;

  const song = await db
    .transaction(async (tx) => {
      const artistIds = await resolveArtistIds(tx, dbValues.artists);
      if (artistIds instanceof Error) throw artistIds;

      return updateSongFull(tx, { id, values: dbValues, artistIds });
    })
    .catch((e) => {
      if (e instanceof DbError) return e;
      return toSongAppleMusicIdError(e, "Failed to sync song.");
    });

  if (song instanceof Error) return song;
  if (song === null) {
    return new DbError({ message: "Song not found.", statusCode: 404 });
  }

  return { song };
};
