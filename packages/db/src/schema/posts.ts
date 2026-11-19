import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, real, snakeCase, text } from "drizzle-orm/sqlite-core";
import { EMBEDDING_DIMENSIONS, POST_CONTENT_MAX } from "../constants.ts";
import { users } from "./auth.ts";
import { createdAt, float16Vector, timestamp, updatedAt } from "./columns.ts";
import { songs } from "./music.ts";

// 一覧系のクエリは必ず「deleted_at IS NULL AND hidden_at IS NULL」を条件に入れる。
// リレーション（users.posts、songs.posts）には、この条件が既定で付いている（relations.ts）。

export const posts = snakeCase.table(
  "posts",
  {
    id: text().primaryKey(), // ランダムな値。そのまま /posts/:id に使う
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 初版は API で必須にする。将来アルバムやプレイリストへの投稿を列追加で足せるよう DB 上は NULL 可。
    songIsrc: text().references(() => songs.isrc, { onDelete: "restrict" }),

    // length は drizzle-orm/zod が API の入力の検証（最大の文字数）に使う。DB では下の CHECK で守る。
    content: text({ length: POST_CONTENT_MAX }).notNull(),

    likeCount: integer().notNull().default(0),
    impressionCount: integer().notNull().default(0),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp(), // 本人による削除。90 日後にバッチが物理削除
    hiddenAt: timestamp(), // 管理者による非表示
  },
  (t) => [
    index("posts_song_created_idx").on(t.songIsrc, t.createdAt), // 「曲で探す」
    index("posts_user_created_idx").on(t.userId, t.createdAt), // 自分の履歴
    index("posts_deleted_at_idx").on(t.deletedAt), // 物理削除バッチ用
    check(
      "posts_content_length",
      sql`length(${t.content}) between 1 and ${POST_CONTENT_MAX}`.inlineParams(),
    ),
  ],
);

/** posts の 1 行（SELECT の結果）。 */
export type Post = typeof posts.$inferSelect;
/** posts に INSERT する値。 */
export type NewPost = typeof posts.$inferInsert;

/**
 * 投稿本文の埋め込み（意味検索用）。posts とは 1 対 1 で、行が無い投稿は検索に出ない。
 * embedding は、モデルが出す 2048 次元の x を、変換 z = Ax + b で 256 次元に落としたもの。
 * 保存した後は書き換えない。統計の変化は、検索時のクエリの変換と並べ直しで補正する。
 *
 * posts に列として持たないのは次の理由から（docs/adr/0001-post-embeddings-table.md）。
 * - ベクトルは数百バイトあり、一覧やリレーショナルクエリで posts を読むたびに転送されてしまう
 * - 投稿の後に非同期で作り、モデルを変えたら作り直すので、投稿本体とは更新の流れが違う
 *
 * 削除・非表示にした投稿は行ごと消して、容量とインデックスを解放する。
 * 埋め込みに失敗した投稿は行を作らず、バッチが posts との LEFT JOIN で見つけて補完する。
 */
export const postEmbeddings = snakeCase.table(
  "post_embeddings",
  {
    postId: text()
      .primaryKey()
      .references(() => posts.id, { onDelete: "cascade" }),
    embedding: float16Vector({ dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    // ‖z‖。並べ直しの SQL で、コサインから内積を組み立てるのに使う。embedding と一緒に書く
    norm: real().notNull(),
    // 新しい計量でのノルム ‖z − m‖_P。2 列を交互に使う。リフレッシュのたびに、バッチが使っていない側を
    // 全行書いてから切り替えるので、検索中の Worker が古い計量を持っていても、その計量の列が読める
    pnormA: real(),
    pnormB: real(),
    model: text().notNull(), // モデルと変換 A の版。変えたらこの値で作り直す対象を探す
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // vector_top_k 用。返る id はこの表の rowid なので、post_embeddings.rowid で結合する。
    // max_neighbors=32 はダミー 1 万件での実測前の仮の値。
    index("post_embeddings_vector_idx").on(
      sql`libsql_vector_idx(${t.embedding}, 'metric=cosine', 'compress_neighbors=float1bit', 'max_neighbors=32')`,
    ),
    index("post_embeddings_model_idx").on(t.model),
    check("post_embeddings_norm", sql`${t.norm} >= 0`),
  ],
);

/**
 * 統計（z の平均と共分散）の差分ログ。post_embeddings のトリガーが、行の追加を +1、削除を −1、
 * 更新をその両方として書く（トリガーは drizzle-kit が扱えないので、マイグレーション 20261118164753_post_embeddings_256 に手で書いた）。
 * バッチが読んで統計に足し、同じトランザクションで消す。
 *
 * 前回のバッチ以降に増えた行を post_embeddings から読む方式にしないのは、削除を統計から引けないため。
 * 削除にも消える前の z が要るので、追加のときも z を残す。
 */
export const embeddingChanges = snakeCase.table(
  "embedding_changes",
  {
    seq: integer().primaryKey({ autoIncrement: true }),
    sign: integer().notNull(), // +1 は追加、−1 は削除
    embedding: float16Vector({ dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    model: text().notNull(), // 統計は変換 A の版ごとに持つので、どの版の z かを残す
  },
  (t) => [check("embedding_changes_sign", sql`${t.sign} in (1, -1)`.inlineParams())],
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
