import { sql } from "drizzle-orm";
import type { Database } from "../lib/db.ts";
import { PurgeError } from "./errors.ts";

/** 物理削除する表と、行を選ぶ列。key は行を指す列、since は期限の起点の日時の列。 */
const targets = {
  users: { key: "id", since: "deleted_at", label: "ユーザー" },
  posts: { key: "id", since: "deleted_at", label: "投稿" },
  post_ip_logs: { key: "post_id", since: "created_at", label: "IP ログ" },
} as const;

/**
 * table の行のうち、since の列が cutoff より前のものを、最大 limit 件消す。消した件数を返す。
 * SQLite の DELETE は LIMIT を書けない（コンパイル時の設定による）ので、消す行を副問い合わせで選ぶ。
 * 子の行（いいね、埋め込み、IP ログ、セッションなど）は、外部キーの ON DELETE CASCADE で消える。
 */
export const purgeRows = ({
  db,
  table,
  cutoff,
  limit,
}: {
  db: Database;
  table: keyof typeof targets;
  cutoff: Date;
  limit: number;
}) => {
  const { key, since, label } = targets[table];
  return db
    .run(
      sql`delete from ${sql.identifier(table)} where ${sql.identifier(key)} in (
        select ${sql.identifier(key)} from ${sql.identifier(table)}
        where ${sql.identifier(since)} < ${cutoff.getTime()} limit ${limit}
      )`,
    )
    .then((result) => result.rowsAffected)
    .catch((e) => new PurgeError({ target: label, cause: e }));
};
