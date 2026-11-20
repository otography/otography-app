import { postIpLogs, posts, postSimilarCaches, users } from "db";
import { inArray, lt, sql } from "drizzle-orm";
import type { Database } from "../lib/db.ts";
import { PurgeError } from "./errors.ts";

/** 物理削除する表と、行を選ぶ列。key は行を指す列、since は期限の起点の日時の列。 */
const targets = {
  users: { table: users, key: users.id, since: users.deletedAt, label: "ユーザー" },
  posts: { table: posts, key: posts.id, since: posts.deletedAt, label: "投稿" },
  post_ip_logs: {
    table: postIpLogs,
    key: postIpLogs.postId,
    since: postIpLogs.createdAt,
    label: "IP ログ",
  },
} as const;

/**
 * table の行のうち、since の列が cutoff より前のものを、最大 limit 件消す。消した件数を返す。
 * SQLite の DELETE は LIMIT を書けない（コンパイル時の設定による）ので、消す行を副問い合わせで選ぶ。
 * 子の行（いいね、埋め込み、IP ログ、セッションなど）は、外部キーの ON DELETE CASCADE で消える。
 */
export const purgeRows = ({
  db,
  table: name,
  cutoff,
  limit,
}: {
  db: Database;
  table: keyof typeof targets;
  cutoff: Date;
  limit: number;
}) => {
  const { table, key, since, label } = targets[name];
  return db
    .delete(table)
    .where(inArray(key, db.select({ key }).from(table).where(lt(since, cutoff)).limit(limit)))
    .then((result) => result.rowsAffected)
    .catch((e) => new PurgeError({ target: label, cause: e }));
};

/** 期限切れの類似検索キャッシュ（親行）を削除する。子行は ON DELETE CASCADE で消える。 */
export const purgeExpiredSimilarCaches = ({
  db,
  cutoff,
  limit,
}: {
  db: Database;
  cutoff: Date;
  limit: number;
}) =>
  db
    .delete(postSimilarCaches)
    .where(
      sql`rowid in (select rowid from ${postSimilarCaches} where ${lt(postSimilarCaches.expiresAt, cutoff)} limit ${limit})`,
    )
    .then((result) => result.rowsAffected)
    .catch((e) => new PurgeError({ target: "類似検索キャッシュ", cause: e }));
