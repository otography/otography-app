import { DbError } from "@repo/errors";
import type { SongCreateDbModel } from "./model";
import { createSong, findSongById, listSongs } from "./repository";

export const getSongs = async () => {
  const rows = await listSongs();
  if (rows instanceof Error) return rows;

  return { songs: rows };
};

export const getSong = async (id: string) => {
  const song = await findSongById(id);
  if (song instanceof Error) return song;
  if (song === null) {
    return new DbError({ message: "Song not found.", statusCode: 404 });
  }

  return { song };
};

export const registerSong = async (payload: SongCreateDbModel) => {
  const rows = await createSong(payload);
  if (rows instanceof Error) return rows;

  const [song] = rows;
  if (!song) {
    return new DbError({ message: "Failed to create song." });
  }

  return { song };
};
