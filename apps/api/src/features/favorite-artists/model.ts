import { type } from "arktype";
import { createInsertSchema } from "drizzle-orm/arktype";
import { artists, favoriteArtists } from "../../shared/db/schema";

// DB カラムのスキーマ（refinement 済み）
const favoriteArtistValuesSchema = createInsertSchema(favoriteArtists, {
  comment: (s) => type.pipe(s, type("string")),
  emoji: (s) => type.pipe(s, type("string <= 20")),
  color: (s) => type.pipe(s, type("string <= 20")),
}).pick("comment", "emoji", "color");

// appleMusicId のバリデーション（trim + 長さ制限）
const artistAppleMusicIdSchema = createInsertSchema(artists, {
  appleMusicId: () => type.pipe(type("string.trim"), type("1 <= string <= 100")),
}).pick("appleMusicId");

// API リクエスト用スキーマ
export const addFavoriteArtistSchema = favoriteArtistValuesSchema.merge(artistAppleMusicIdSchema);

export type AddFavoriteArtistInput = typeof addFavoriteArtistSchema.infer;
export type FavoriteArtistValues = typeof favoriteArtistValuesSchema.infer;
