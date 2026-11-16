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
import { FAVORITE_COMMENT_MAX, type FavoriteColor } from "../constants.ts";
import { users } from "./auth.ts";
import { createdAt, updatedAt } from "./columns.ts";
import { artists, songs } from "./music.ts";

// プロフィールに載せるお気に入り。曲とアーティストは同じ形で、違うのは対象の列だけ。
// 件数上限・絵文字 1 つ・色の候補は API で検証する。

/** お気に入りに共通の列。テーブルごとに新しい列を作るため関数にしている。 */
const favoriteColumns = () => ({
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  comment: text(),
  emoji: text(),
  color: text().$type<FavoriteColor>(),
  position: integer().notNull(), // 本人が決める並び順（0 始まり）
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** お気に入りに共通の制約。target は対象（曲・アーティスト）を指す列。 */
const favoriteConstraints = (
  table: string,
  t: { userId: SQLiteColumn; comment: SQLiteColumn },
  target: SQLiteColumn,
) => [
  primaryKey({ columns: [t.userId, target] }),
  index(`${table}_target_idx`).on(target), // 対象からの逆引き（RESTRICT の確認など）
  check(
    `${table}_comment_length`,
    sql`${t.comment} is null or length(${t.comment}) <= ${sql.raw(String(FAVORITE_COMMENT_MAX))}`,
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
