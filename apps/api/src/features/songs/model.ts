import { createInsertSchema } from "drizzle-orm/arktype";
import { type } from "arktype";
import { songs } from "../../shared/db/schema";

export const songInsertSchema = createInsertSchema(songs, {
  title: (s) => type.pipe(s, type("1 <= string <= 255")),
  length: (s) => type.pipe(s, type("number.integer >= 0")),
  isrcs: (s) => type.pipe(s, type("string.trim"), type("1 <= string <= 50")),
}).pick("title", "length", "isrcs");

export type SongCreateDbModel = typeof songInsertSchema.infer;
