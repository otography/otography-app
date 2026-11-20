import type { Database } from "../../lib/db.ts";
import { purgeExpiredSimilarCaches, purgeRows } from "../repository.ts";

/** 論理削除した行と IP ログを残す期間（設計ドキュメント）。 */
const RETENTION_DAYS = 90;
/** 1 回の実行で、種類ごとに消す行数の上限。残りは翌日の実行で消す。 */
const PURGE_LIMIT = 500;

/**
 * 保存期間を過ぎた行を物理削除する。1 日 1 回、Cron トリガーから呼ぶ。
 * ユーザーを先に消すと、その投稿も CASCADE で消える。種類ごとに件数を返す。
 */
export async function purgeExpired({ db, now }: { db: Database; now: Date }) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const users = await purgeRows({ db, table: "users", cutoff, limit: PURGE_LIMIT });
  if (users instanceof Error) return users;
  const posts = await purgeRows({ db, table: "posts", cutoff, limit: PURGE_LIMIT });
  if (posts instanceof Error) return posts;
  const ipLogs = await purgeRows({ db, table: "post_ip_logs", cutoff, limit: PURGE_LIMIT });
  if (ipLogs instanceof Error) return ipLogs;
  const similarCaches = await purgeExpiredSimilarCaches({ db, cutoff: now, limit: PURGE_LIMIT });
  if (similarCaches instanceof Error) return similarCaches;

  return { users, posts, ipLogs, similarCaches };
}
