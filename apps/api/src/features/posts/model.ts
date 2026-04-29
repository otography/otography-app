import { createInsertSchema, createUpdateSchema } from "drizzle-orm/arktype";
import { type } from "arktype";
import { posts } from "../../shared/db/schema";

export const postInsertSchema = createInsertSchema(posts, {
  content: (s) => type.pipe(s, type("string.trim"), type("1 <= string")),
}).pick("songId", "content");

export const postUpdateSchema = createUpdateSchema(posts, {
  content: (s) => type.pipe(s, type("string.trim"), type("1 <= string")),
})
  .pick("songId", "content")
  .partial();

export type PostCreateDbModel = typeof postInsertSchema.infer;
export type PostUpdateDbModel = typeof postUpdateSchema.infer;
export type PostInsertDbModel = PostCreateDbModel & {
  userId: string;
};
