import { createInsertSchema, createUpdateSchema } from "drizzle-orm/arktype";
import { type } from "arktype";
import { posts, songs } from "../../shared/db/schema";

// API リクエスト用スキーマ（appleMusicId で曲を指定）
const postAppleMusicIdSchema = createInsertSchema(songs, {
  appleMusicId: (s) => type.pipe(s, type("string.trim"), type("1 <= string <= 100")),
}).pick("appleMusicId");

export const postInsertSchema = createInsertSchema(posts, {
  content: (s) => type.pipe(s, type("string.trim"), type("string >= 1")),
})
  .pick("content")
  .merge(postAppleMusicIdSchema);

export const postUpdateSchema = createUpdateSchema(posts, {
  content: (s) => type.pipe(s, type("string.trim"), type("string >= 1")),
})
  .pick("content")
  .partial();

const postDbInsertSchema = createInsertSchema(posts).pick("songId", "userId", "content");

export type PostCreateDbModel = typeof postInsertSchema.infer;
export type PostUpdateDbModel = typeof postUpdateSchema.infer;
export type PostInsertDbModel = typeof postDbInsertSchema.infer;
