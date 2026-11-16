import { posts, songs } from "db";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { songOutput } from "../songs/schemas.ts";
import { ISRC_LENGTH } from "db";

// 検証の規則は drizzle のスキーマ（列の型、length）から作る。ここで足すのは、DB の CHECK 制約にあたる規則だけ。
const postInsert = createInsertSchema(posts, {
  content: (schema) => schema.trim().min(1),
});
const songInsert = createInsertSchema(songs, {
  isrc: (schema) => schema.length(ISRC_LENGTH).toUpperCase(),
});

/** POST /api/posts の入力。曲は Apple Music の ID と ISRC だけを受け取る（曲名などは受け取らない）。 */
export const createPostInput = postInsert.pick({ content: true }).extend({
  songId: songInsert.shape.appleSongId,
  isrc: songInsert.shape.isrc,
});

/** 投稿 1 件の応答。内部のユーザー ID や件数の列は含めない。 */
export const postOutput = createSelectSchema(posts)
  .pick({ id: true, content: true, createdAt: true })
  .extend({ song: songOutput });
