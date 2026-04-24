import { DbError } from "@repo/errors";
import {
  createArtist,
  findArtistById,
  listArtists,
  softDeleteArtistById,
  updateArtistById,
} from "./repository";
import type { ArtistCreateDbModel, ArtistUpdateDbModel } from "./model";

export const getArtists = async () => {
  const rows = await listArtists();
  if (rows instanceof Error) return rows;

  return { artists: rows };
};

export const getArtist = async (id: string) => {
  const artist = await findArtistById(id);
  if (artist instanceof Error) return artist;
  if (artist === null) {
    return new DbError({ message: "Artist not found.", statusCode: 404 });
  }

  return { artist };
};

export const registerArtist = async (payload: ArtistCreateDbModel) => {
  const rows = await createArtist(payload);
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
  const updatedArtist = await updateArtistById({
    id,
    values: payload,
  });
  if (updatedArtist instanceof Error) return updatedArtist;
  if (updatedArtist === null) {
    return new DbError({ message: "Artist not found.", statusCode: 404 });
  }

  return { artist: updatedArtist };
};

export const removeArtist = async (id: string) => {
  const deletedArtist = await softDeleteArtistById(id);
  if (deletedArtist instanceof Error) return deletedArtist;
  if (deletedArtist === null) {
    return new DbError({ message: "Artist not found.", statusCode: 404 });
  }

  return { deleted: true };
};
