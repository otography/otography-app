import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { SongCreateDbModel } from "./model";
import { createSong, findSongById, listSongs } from "./repository";

export class SongUsecaseError extends Error {
  statusCode: ContentfulStatusCode;

  constructor(message: string, statusCode: ContentfulStatusCode) {
    super(message);
    this.name = "SongUsecaseError";
    this.statusCode = statusCode;
  }
}

export const getSongs = async () => {
  const rows = await listSongs();
  if (rows instanceof Error) {
    return new SongUsecaseError("Failed to fetch songs.", 500);
  }

  return { songs: rows };
};

export const getSong = async (id: string) => {
  const song = await findSongById(id);
  if (song instanceof Error) {
    return new SongUsecaseError("Failed to fetch song.", 500);
  }
  if (song === null) {
    return new SongUsecaseError("Song not found.", 404);
  }

  return { song };
};

export const registerSong = async (payload: SongCreateDbModel) => {
  const rows = await createSong(payload);
  if (rows instanceof Error) {
    return new SongUsecaseError("Failed to create song.", 500);
  }

  const [song] = rows;
  if (!song) {
    return new SongUsecaseError("Failed to create song.", 500);
  }

  return { song };
};
