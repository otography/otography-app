import { DbError } from "@repo/errors";
import { createDb } from "../../shared/db";
import {
  createArtist,
  findArtistById,
  listArtists,
  softDeleteArtistById,
  updateArtistById,
} from "./repository";
import type { ArtistCreateDbModel, ArtistUpdateDbModel } from "./model";

export const getArtists = async () => {
  const db = createDb();
  const rows = await db
    .transaction((tx) => listArtists(tx))
    .catch((e) => new DbError({ message: "Failed to fetch artists.", cause: e }));
  if (rows instanceof Error) return rows;

  return { artists: rows };
};

export const getArtist = async (id: string) => {
  const db = createDb();
  const artist = await db
    .transaction((tx) => findArtistById(tx, id))
    .catch((e) => new DbError({ message: "Failed to fetch artist.", cause: e }));
  if (artist instanceof Error) return artist;
  if (artist === null) {
    return new DbError({ message: "Artist not found.", statusCode: 404 });
  }

  return { artist };
};

export const registerArtist = async (payload: ArtistCreateDbModel) => {
  const db = createDb();
  const rows = await db
    .transaction((tx) => createArtist(tx, payload))
    .catch((e) => new DbError({ message: "Failed to create artist.", cause: e }));
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
  const updatedArtist = await db
    .transaction((tx) => updateArtistById(tx, { id, values: payload }))
    .catch((e) => new DbError({ message: "Failed to update artist.", cause: e }));
  if (updatedArtist instanceof Error) return updatedArtist;
  if (updatedArtist === null) {
    return new DbError({ message: "Artist not found.", statusCode: 404 });
  }

  return { artist: updatedArtist };
};

export const removeArtist = async (id: string) => {
  const db = createDb();
  const deletedArtist = await db
    .transaction((tx) => softDeleteArtistById(tx, id))
    .catch((e) => new DbError({ message: "Failed to delete artist.", cause: e }));
  if (deletedArtist instanceof Error) return deletedArtist;
  if (deletedArtist === null) {
    return new DbError({ message: "Artist not found.", statusCode: 404 });
  }

  return { deleted: true };
};
