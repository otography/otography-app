import { DbError } from "@repo/errors";
import { createDb } from "../../shared/db";
import type { SongCreateDbModel } from "./model";
import { createSong, findSongById, listSongs } from "./repository";

export const getSongs = async () => {
  const db = createDb();
  const rows = await db
    .transaction((tx) => listSongs(tx))
    .catch((e) => new DbError({ message: "Failed to fetch songs.", cause: e }));
  if (rows instanceof Error) return rows;

  return { songs: rows };
};

export const getSong = async (id: string) => {
  const db = createDb();
  const song = await db
    .transaction((tx) => findSongById(tx, id))
    .catch((e) => new DbError({ message: "Failed to fetch song.", cause: e }));
  if (song instanceof Error) return song;
  if (song === null) {
    return new DbError({ message: "Song not found.", statusCode: 404 });
  }

  return { song };
};

export const registerSong = async (payload: SongCreateDbModel) => {
  const db = createDb();
  const rows = await db
    .transaction((tx) => createSong(tx, payload))
    .catch((e) => new DbError({ message: "Failed to create song.", cause: e }));
  if (rows instanceof Error) return rows;

  const [song] = rows;
  if (!song) {
    return new DbError({ message: "Failed to create song." });
  }

  return { song };
};
