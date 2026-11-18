import { ISRC_LENGTH, posts, songs, users } from "db";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { songOutput } from "../songs/schemas.ts";

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

/** 他人に見せる投稿 1 件の応答。投稿者、いいねの件数、閲覧者がいいね済みかを含める。 */
export const postViewOutput = createSelectSchema(posts)
  .pick({ id: true, content: true, likeCount: true, createdAt: true })
  .extend({
    author: createSelectSchema(users).pick({ publicId: true, name: true }),
    song: songOutput.nullable(),
    likedByMe: z.boolean(),
  });

/**
 * 一覧の続きを読むための位置。最後の投稿の作成日時（epoch ミリ秒）と ID を「_」でつなぐ。
 * 作成日時が同じ投稿があっても、ID で順序が決まる。
 */
const cursorPattern = /^(\d+)_([a-z0-9]+)$/;

const postCursor = z
  .string()
  .regex(cursorPattern)
  .transform((value) => {
    const [, ms = "", id = ""] = cursorPattern.exec(value) ?? [];
    return { createdAt: new Date(Number(ms)), id };
  });

export const encodePostCursor = (post: { createdAt: Date; id: string }) =>
  `${post.createdAt.getTime()}_${post.id}`;

/** GET /api/users/:publicId/posts のクエリ。 */
export const listPostsQuery = z.object({ cursor: postCursor.optional() });
