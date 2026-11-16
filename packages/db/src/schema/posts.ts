import { sql } from "drizzle-orm";
import { index, integer, primaryKey, snakeCase, text } from "drizzle-orm/sqlite-core";
import { EMBEDDING_DIMENSIONS } from "../constants.ts";
import { users } from "./auth.ts";
import { createdAt, float16Vector, timestamp, updatedAt } from "./columns.ts";
import { songs } from "./music.ts";

// - posts.embedding は 4KB あるので、SELECT では必ず列を明示して除外する。
// - 一覧系のクエリは必ず「deleted_at IS NULL AND hidden_at IS NULL」を条件に入れる。

export const posts = snakeCase.table(
  "posts",
  {
    id: text().primaryKey(), // ランダムな値。そのまま /posts/:id に使う
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 初版は API で必須にする。将来アルバムやプレイリストへの投稿を列追加で足せるよう DB 上は NULL 可。
    songIsrc: text().references(() => songs.isrc, { onDelete: "restrict" }),

    content: text().notNull(),

    likeCount: integer().notNull().default(0),
    impressionCount: integer().notNull().default(0),

    // 本文だけを埋め込む。削除・非表示のときは NULL にして容量とインデックスを解放する。
    // 埋め込みに失敗した投稿も NULL で保存し、バッチで後から補完する。
    embedding: float16Vector({ dimensions: EMBEDDING_DIMENSIONS }),
    embeddingModel: text(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp(), // 本人による削除。90 日後にバッチが物理削除
    hiddenAt: timestamp(), // 管理者による非表示
  },
  (t) => [
    index("posts_song_created_idx").on(t.songIsrc, t.createdAt), // 「曲で探す」
    index("posts_user_created_idx").on(t.userId, t.createdAt), // 自分の履歴
    index("posts_deleted_at_idx").on(t.deletedAt), // 物理削除バッチ用
    // ベクトル検索（vector_top_k）用。embedding が NULL の行（削除済み・非表示・埋め込み失敗）は除外する。
    // max_neighbors=32 はダミー 1 万件での実測前の仮の値。
    index("posts_embedding_idx")
      .on(
        sql`libsql_vector_idx(${t.embedding}, 'metric=cosine', 'compress_neighbors=float1bit', 'max_neighbors=32')`,
      )
      .where(sql`${t.embedding} is not null`),
  ],
);

export const likes = snakeCase.table(
  "likes",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] }), index("likes_post_idx").on(t.postId)],
);
