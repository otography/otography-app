import { sql } from "drizzle-orm";
import {
  type SQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  snakeCase,
  text,
} from "drizzle-orm/sqlite-core";
import { FAVORITE_COLORS, FAVORITE_COMMENT_MAX } from "../constants.ts";
import { users } from "./auth.ts";
import { createdAt, updatedAt } from "./columns.ts";
import { artists, songs } from "./music.ts";

// プロフィールに載せるお気に入り。曲とアーティストは同じ形で、違うのは対象の列だけ。
// 件数の上限と絵文字 1 つは API で検証する。コメントの長さと色の候補は DB でも守る。

/** お気に入りに共通の列。テーブルごとに新しい列を作るため関数にしている。 */
const favoriteColumns = () => ({
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  comment: text({ length: FAVORITE_COMMENT_MAX }),
  emoji: text(),
  color: text({ enum: FAVORITE_COLORS }),
  position: integer().notNull(), // 本人が決める並び順（0 始まり）
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** お気に入りに共通の制約。target は対象（曲・アーティスト）を指す列。 */
const favoriteConstraints = (
  table: string,
  t: { userId: SQLiteColumn; comment: SQLiteColumn; color: SQLiteColumn },
  target: SQLiteColumn,
) => [
  primaryKey({ columns: [t.userId, target] }),
  index(`${table}_target_idx`).on(target), // 対象からの逆引き（RESTRICT の確認など）
  check(
    `${table}_comment_length`,
    sql`${t.comment} is null or length(${t.comment}) <= ${sql.raw(String(FAVORITE_COMMENT_MAX))}`,
  ),
  check(
    `${table}_color`,
    sql`${t.color} is null or ${t.color} in (${sql.raw(FAVORITE_COLORS.map((c) => `'${c}'`).join(", "))})`,
  ),
];

export const favoriteSongs = snakeCase.table(
  "favorite_songs",
  {
    ...favoriteColumns(),
    songIsrc: text()
      .notNull()
      .references(() => songs.isrc, { onDelete: "restrict" }),
  },
  (t) => favoriteConstraints("favorite_songs", t, t.songIsrc),
);

export const favoriteArtists = snakeCase.table(
  "favorite_artists",
  {
    ...favoriteColumns(),
    artistId: text()
      .notNull()
      .references(() => artists.id, { onDelete: "restrict" }),
  },
  (t) => favoriteConstraints("favorite_artists", t, t.artistId),
);
