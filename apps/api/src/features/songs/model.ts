import { type } from "arktype";
import { createInsertSchema, createUpdateSchema } from "drizzle-orm/arktype";
import { songs } from "../../shared/db/schema";

export const songInsertSchema = createInsertSchema(songs, {
  title: (s) => type.pipe(s, type("1 <= string <= 255")),
  appleMusicId: () => type.pipe(type("string.trim"), type("1 <= string <= 100")),
  length: (s) => type.pipe(s, type("null | number.integer >= 0")),
  isrcs: (s) => type.pipe(s, type("null | string.trim"), type("null | 1 <= string <= 50")),
}).pick("title", "appleMusicId", "length", "isrcs");

export const songUpdateSchema = createUpdateSchema(songs, {
  title: (s) => type.pipe(s, type("1 <= string <= 255")),
  appleMusicId: () => type.pipe(type("string.trim"), type("1 <= string <= 100")),
  length: (s) => type.pipe(s, type("null | number.integer >= 0")),
  isrcs: (s) => type.pipe(s, type("null | string.trim"), type("null | 1 <= string <= 50")),
}).pick("title", "appleMusicId", "length", "isrcs");

export type SongCreateDbModel = typeof songInsertSchema.infer;
export type SongUpdateDbModel = typeof songUpdateSchema.infer;

export type SongCreatePayload = SongCreateDbModel & {
  artistId?: string;
};

export type SongUpdatePayload = SongUpdateDbModel & {
  artistId?: string | null;
};

export const toSongCreateDbModel = (input: SongCreatePayload): SongCreateDbModel => {
  const { artistId: _artistId, ...song } = input;
  return song;
};

export const toSongUpdateDbModel = (input: SongUpdatePayload): SongUpdateDbModel => {
  const { artistId: _artistId, ...song } = input;
  return song;
};
