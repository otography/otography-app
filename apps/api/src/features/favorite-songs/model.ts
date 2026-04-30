import { type } from "arktype";
import { createInsertSchema } from "drizzle-orm/arktype";
import { songs, favoriteSongs } from "../../shared/db/schema";

// DB カラムのスキーマ（refinement 済み）
const favoriteSongValuesSchema = createInsertSchema(favoriteSongs, {
  comment: (s) => type.pipe(s, type("string")),
  emoji: (s) => type.pipe(s, type("string <= 20")),
  color: (s) => type.pipe(s, type("string <= 20")),
}).pick("comment", "emoji", "color");

// appleMusicId のバリデーション（trim + 長さ制限）
const songAppleMusicIdSchema = createInsertSchema(songs, {
  appleMusicId: () => type.pipe(type("string.trim"), type("1 <= string <= 100")),
}).pick("appleMusicId");

// API リクエスト用スキーマ
export const addFavoriteSongSchema = favoriteSongValuesSchema.merge(songAppleMusicIdSchema);

export type AddFavoriteSongInput = typeof addFavoriteSongSchema.infer;
export type FavoriteSongValues = typeof favoriteSongValuesSchema.infer;
