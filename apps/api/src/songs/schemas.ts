import { songs } from "db";
import { createSelectSchema } from "drizzle-orm/zod";

/** 応答に含める曲の項目（投稿、お気に入りなどで共通）。 */
export const songOutput = createSelectSchema(songs).pick({
  isrc: true,
  appleSongId: true,
  title: true,
  artistName: true,
  albumName: true,
  durationMs: true,
  artworkUrl: true,
  url: true,
});
