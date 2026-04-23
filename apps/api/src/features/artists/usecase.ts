import {
  createArtist,
  findArtistById,
  listArtists,
  softDeleteArtistById,
  updateArtistById,
} from "./repository";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  type ArtistCreatePayload,
  type ArtistUpdatePayload,
  toArtist,
  toArtistCreateDbModel,
  toArtistUpdateDbModel,
} from "./model";

export class ArtistUsecaseError extends Error {
  statusCode: ContentfulStatusCode;

  constructor(message: string, statusCode: ContentfulStatusCode) {
    super(message);
    this.name = "ArtistUsecaseError";
    this.statusCode = statusCode;
  }
}

export const getArtists = async () => {
  const rows = await listArtists();
  if (rows instanceof Error) {
    return new ArtistUsecaseError("Failed to fetch artists.", 500);
  }

  return { artists: rows.map(toArtist) };
};

export const getArtist = async (id: string) => {
  const artist = await findArtistById(id);
  if (artist instanceof Error) {
    return new ArtistUsecaseError("Failed to fetch artist.", 500);
  }
  if (artist === null) {
    return new ArtistUsecaseError("Artist not found.", 404);
  }

  return { artist: toArtist(artist) };
};

export const registerArtist = async (payload: ArtistCreatePayload) => {
  const rows = await createArtist(toArtistCreateDbModel(payload));
  if (rows instanceof Error) {
    return new ArtistUsecaseError("Failed to create artist.", 500);
  }

  const [artist] = rows;
  if (!artist) {
    return new ArtistUsecaseError("Failed to create artist.", 500);
  }

  return { artist: toArtist(artist) };
};

type UpdateArtistInput = {
  id: string;
  payload: ArtistUpdatePayload;
};

export const modifyArtist = async ({ id, payload }: UpdateArtistInput) => {
  const updatedArtist = await updateArtistById({
    id,
    values: toArtistUpdateDbModel(payload),
  });
  if (updatedArtist instanceof Error) {
    return new ArtistUsecaseError("Failed to update artist.", 500);
  }
  if (updatedArtist === null) {
    return new ArtistUsecaseError("Artist not found.", 404);
  }

  return { artist: toArtist(updatedArtist) };
};

export const removeArtist = async (id: string) => {
  const deletedArtist = await softDeleteArtistById(id);
  if (deletedArtist instanceof Error) {
    return new ArtistUsecaseError("Failed to delete artist.", 500);
  }
  if (deletedArtist === null) {
    return new ArtistUsecaseError("Artist not found.", 404);
  }

  return { deleted: true };
};
