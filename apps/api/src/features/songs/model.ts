import { type } from "arktype";
import { createInsertSchema } from "drizzle-orm/arktype";
import { songs } from "../../shared/db/schema";

// 曲登録APIのリクエストボディ（appleMusicIdのみ受け取る）
export const songCreateBodySchema = type({
  appleMusicId: type.pipe(type("string.trim"), type("1 <= string <= 100")),
});

// 曲再同期APIのリクエストボディ（空ボディ、PATCHでApple Music APIから再フェッチ）
export const songSyncBodySchema = type({});

export type SongCreateBody = typeof songCreateBodySchema.infer;

// Drizzle の songs テーブルスキーマからDB挿入値を生成し、API由来のフィールドを追加
const songDbInsertSchema = createInsertSchema(songs, {
  title: (s) => type.pipe(s, type("1 <= string <= 255")),
  appleMusicId: (s) => type.pipe(s, type("string.trim"), type("1 <= string <= 100")),
  length: (s) => type.pipe(s, type("null | number.integer >= 0")),
  isrcs: (s) => type.pipe(s, type("null | string.trim"), type("null | 1 <= string <= 50")),
}).pick("title", "appleMusicId", "length", "isrcs");

export type SongDbValues = typeof songDbInsertSchema.infer;

// DB挿入値 + Apple Music API由来の追加フィールド
export type SongCreateDbValues = SongDbValues & {
  genreNames: string[];
  artists: { appleMusicId: string; name: string }[];
};
