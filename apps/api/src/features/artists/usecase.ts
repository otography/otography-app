import { DbError } from "@repo/errors";
import { createDb } from "../../shared/db";
import { isPostgresUniqueViolation } from "../../shared/db/postgres-error";
import {
  createArtist,
  findArtistById,
  listArtists,
  softDeleteArtistById,
  updateArtistById,
} from "./repository";
import type { ArtistCreateDbModel, ArtistUpdateDbModel } from "./model";

const ARTIST_APPLE_MUSIC_ID_KEY = "artists_apple_music_id_key";

const toArtistAppleMusicIdError = (error: unknown, fallbackMessage: string) => {
  if (isPostgresUniqueViolation(error, ARTIST_APPLE_MUSIC_ID_KEY)) {
    return new DbError({
      message: "Apple Music ID is already registered for another artist.",
      statusCode: 409,
      cause: error,
    });
  }

  return new DbError({ message: fallbackMessage, cause: error });
};

export const getArtists = async () => {
  const db = createDb();
  const rows = await listArtists(db).catch(
    (e) => new DbError({ message: "Failed to fetch artists.", cause: e }),
  );
  if (rows instanceof Error) return rows;

  return { artists: rows };
};

export const getArtist = async (id: string) => {
  const db = createDb();
  const artist = await findArtistById(db, id).catch(
    (e) => new DbError({ message: "Failed to fetch artist.", cause: e }),
  );
  if (artist instanceof Error) return artist;
  if (artist === null) {
    return new DbError({ message: "Artist not found.", statusCode: 404 });
  }

  return { artist };
};

export const registerArtist = async (payload: ArtistCreateDbModel) => {
  const db = createDb();
  const rows = await createArtist(db, payload).catch((e) =>
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
    return new DbError({ message: "Artist not found.", statusCode: 404 });
  }

  return { artist: updatedArtist };
};

export const removeArtist = async (id: string) => {
  const db = createDb();
  const deletedArtist = await softDeleteArtistById(db, id).catch(
    (e) => new DbError({ message: "Failed to delete artist.", cause: e }),
  );
  if (deletedArtist instanceof Error) return deletedArtist;
  if (deletedArtist === null) {
    return new DbError({ message: "Artist not found.", statusCode: 404 });
  }

  return { deleted: true };
};
