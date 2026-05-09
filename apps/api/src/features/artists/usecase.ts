import { DbError } from "@repo/errors";
import { createDb } from "../../shared/db";
import type { Cursor } from "../../shared/pagination";
import { buildPaginationMeta, normalizeLimit, trimItems } from "../../shared/pagination";
import { toDbError } from "../../shared/db/postgres-error";
import { fetchArtist } from "../../shared/apple-music";
import { domainDbError } from "../../shared/errors/domain-error";
import {
  type ArtistCreateBody,
  type ArtistCreateDbValues,
  type ArtistUpdateDbModel,
} from "./model";
import {
  createArtist,
  findArtistById,
  listArtists,
  softDeleteArtistById,
  updateArtistById,
} from "./repository";

const ARTIST_APPLE_MUSIC_ID_KEY = "artists_apple_music_id_key";

const toArtistAppleMusicIdError = (error: unknown, fallbackMessage: string) => {
  return toDbError(error, fallbackMessage, {
    constraints: [ARTIST_APPLE_MUSIC_ID_KEY],
  });
};

export const getArtists = async (pagination?: { limit?: number; cursor?: Cursor | null }) => {
  const db = createDb();
  const limit = normalizeLimit(pagination?.limit);
  const rows = await listArtists(db, { limit, cursor: pagination?.cursor }).catch((e) =>
    toDbError(e, "Failed to fetch artists."),
  );
  if (rows instanceof Error) return rows;

  const paginationMeta = buildPaginationMeta(rows, limit);
  const trimmed = trimItems(rows, limit);

  return { artists: trimmed, pagination: paginationMeta };
};

export const getArtist = async (id: string) => {
  const db = createDb();
  const artist = await findArtistById(db, id).catch((e) => toDbError(e, "Failed to fetch artist."));
  if (artist instanceof Error) return artist;
  if (artist === null) {
    return domainDbError({
      slug: "artist-not-found",
      message: "Artist not found.",
    });
  }

  return { artist };
};

export const registerArtist = async (payload: ArtistCreateBody) => {
  const apiResponse = await fetchArtist(payload.appleMusicId);
  if (apiResponse instanceof Error) return apiResponse;

  const dbValues: ArtistCreateDbValues = {
    name: apiResponse.attributes.name,
    appleMusicId: apiResponse.id,
    ipiCode: null,
    gender: null,
    birthdate: null,
  };

  const db = createDb();
  const rows = await createArtist(db, dbValues).catch((e) =>
    toArtistAppleMusicIdError(e, "Failed to create artist."),
  );
  if (rows instanceof Error) return rows;

  const [artist] = rows;
  if (!artist) {
    return new DbError({ message: "Failed to create artist." });
  }

  return { artist };
};

type UpdateArtistInput = {
  id: string;
  payload: ArtistUpdateDbModel;
};

export const modifyArtist = async ({ id, payload }: UpdateArtistInput) => {
  const db = createDb();
  const updatedArtist = await updateArtistById(db, { id, values: payload }).catch((e) =>
    toArtistAppleMusicIdError(e, "Failed to update artist."),
  );
  if (updatedArtist instanceof Error) return updatedArtist;
  if (updatedArtist === null) {
    return domainDbError({
      slug: "artist-not-found",
      message: "Artist not found.",
    });
  }

  return { artist: updatedArtist };
};

export const removeArtist = async (id: string) => {
  const db = createDb();
  const deletedArtist = await softDeleteArtistById(db, id).catch((e) =>
    toDbError(e, "Failed to delete artist."),
  );
  if (deletedArtist instanceof Error) return deletedArtist;
  if (deletedArtist === null) {
    return domainDbError({
      slug: "artist-not-found",
      message: "Artist not found.",
    });
  }

  return { deleted: true };
};
