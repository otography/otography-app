import { DbError } from "@repo/errors";
import { createDb } from "../../shared/db";
import {
  type SongCreatePayload,
  type SongUpdatePayload,
  toSongCreateDbModel,
  toSongUpdateDbModel,
} from "./model";
import {
  createSongWithArtist,
  findActiveArtistById,
  findSongById,
  listSongs,
  updateSongById,
} from "./repository";

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

export const registerSong = async (payload: SongCreatePayload) => {
  const db = createDb();

  if (payload.artistId !== undefined) {
    const artist = await findActiveArtistById(db, payload.artistId).catch(
      (e) => new DbError({ message: "Failed to fetch artist.", cause: e }),
    );
    if (artist instanceof Error) return artist;
    if (artist === null) {
      return new DbError({ message: "Artist not found.", statusCode: 404 });
    }
  }

  const song = await db
    .transaction((tx) =>
      createSongWithArtist(tx, {
        values: toSongCreateDbModel(payload),
        artistId: payload.artistId,
      }),
    )
    .catch((e) => new DbError({ message: "Failed to create song.", cause: e }));
  if (song instanceof Error) return song;
  if (!song) {
    return new DbError({ message: "Failed to create song." });
  }

  return { song };
};

type UpdateSongInput = {
  id: string;
  payload: SongUpdatePayload;
};

export const modifySong = async ({ id, payload }: UpdateSongInput) => {
  const db = createDb();

  if (payload.artistId !== undefined && payload.artistId !== null) {
    const artist = await findActiveArtistById(db, payload.artistId).catch(
      (e) => new DbError({ message: "Failed to fetch artist.", cause: e }),
    );
    if (artist instanceof Error) return artist;
    if (artist === null) {
      return new DbError({ message: "Artist not found.", statusCode: 404 });
    }
  }

  const song = await db
    .transaction((tx) =>
      updateSongById(tx, {
        id,
        values: toSongUpdateDbModel(payload),
        artistId: payload.artistId,
      }),
    )
    .catch((e) => new DbError({ message: "Failed to update song.", cause: e }));

  if (song instanceof Error) return song;
  if (song === null) {
    return new DbError({ message: "Song not found.", statusCode: 404 });
  }

  return { song };
};
