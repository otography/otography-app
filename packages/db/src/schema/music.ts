import { sql } from "drizzle-orm";
import { check, index, integer, snakeCase, text } from "drizzle-orm/sqlite-core";
import { ISRC_LENGTH } from "../constants.ts";
import { createdAt, timestamp } from "./columns.ts";

// Apple Music のキャッシュ。ストアフロントは jp・日本語に固定。
// 表示用の列はすべて NULL 可で、検索や並べ替えの条件には使わない（規約上保存できなかった場合に
// ID だけ残す形へ退避するため）。行は削除せず、配信が終わったら unavailable_at を立てる。

export const songs = snakeCase.table(
  "songs",
  {
    isrc: text({ length: ISRC_LENGTH }).primaryKey(), // 版違いを 1 行にまとめる
    // 再生に使う代表の ID。最初に投稿された版。無効になったら ISRC で引き直して差し替える
    appleSongId: text().notNull().unique(),

    title: text(),
    artistName: text(), // 表示用の文字列（例: "A & B"）
    albumName: text(),
    durationMs: integer(),
    artworkUrl: text(), // {w}x{h} を含むテンプレート。画像本体は保存しない
    url: text(), // Apple Music へのリンク

    // Apple のアーティスト ID の JSON 配列。今は読まない。
    // 後で song_artists を作るとき、Apple に問い合わせ直さずに済ませるための保険。
    artistIds: text({ mode: "json" }).$type<string[]>(),

    fetchedAt: timestamp().notNull(),
    unavailableAt: timestamp(),
    createdAt: createdAt(),
  },
  (t) => [
    check("songs_isrc_format", sql`length(${t.isrc}) = ${ISRC_LENGTH}`.inlineParams()),
    index("songs_fetched_at_idx").on(t.fetchedAt), // 取り直しバッチ用
  ],
);

/** songs の 1 行（SELECT の結果）。 */
export type Song = typeof songs.$inferSelect;

/** 誰かがお気に入りにしたアーティストだけを保存する。 */
export const artists = snakeCase.table(
  "artists",
  {
    id: text().primaryKey(), // Apple Music のアーティスト ID
    name: text(),
    artworkUrl: text(),
    url: text(),
    fetchedAt: timestamp().notNull(),
    unavailableAt: timestamp(),
    createdAt: createdAt(),
  },
  (t) => [index("artists_fetched_at_idx").on(t.fetchedAt)],
);

/** artists の 1 行（SELECT の結果）。 */
export type Artist = typeof artists.$inferSelect;
