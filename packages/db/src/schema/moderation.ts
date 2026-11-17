import { inArray, sql } from "drizzle-orm";
import { check, index, snakeCase, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { REPORT_DETAIL_MAX, REPORT_REASONS, REPORT_STATUSES } from "../constants.ts";
import { users } from "./auth.ts";
import { createdAt, timestamp } from "./columns.ts";
import { posts } from "./posts.ts";

/**
 * 通報。対象は投稿かユーザー（お気に入りのコメントはユーザーへの通報で扱う）。
 * 投稿への通報では、target_user_id に投稿者を入れる（管理者がユーザーごとに通報を見られるように）。
 * 対象が物理削除されると列は NULL になるので、「どちらかが NULL でない」は API で検証する。
 */
export const reports = snakeCase.table(
  "reports",
  {
    id: text().primaryKey(),
    reporterId: text().references(() => users.id, { onDelete: "set null" }),
    postId: text().references(() => posts.id, { onDelete: "set null" }),
    targetUserId: text().references(() => users.id, { onDelete: "set null" }),
    reason: text({ enum: REPORT_REASONS }).notNull(),
    // length は drizzle-orm/zod が API の入力の検証に使う。DB では下の CHECK で守る。
    detail: text({ length: REPORT_DETAIL_MAX }),
    status: text({ enum: REPORT_STATUSES }).notNull().default("open"),
    createdAt: createdAt(),
    resolvedAt: timestamp(),
  },
  (t) => [
    index("reports_status_created_idx").on(t.status, t.createdAt),
    index("reports_post_idx").on(t.postId),
    index("reports_target_user_idx").on(t.targetUserId),
    index("reports_reporter_idx").on(t.reporterId),
    // 同じ人が、同じ対象を、未処理のまま重ねて通報できないようにする。
    uniqueIndex("reports_open_post_unique")
      .on(t.reporterId, t.postId)
      .where(sql`${t.status} = 'open' and ${t.postId} is not null`),
    uniqueIndex("reports_open_user_unique")
      .on(t.reporterId, t.targetUserId)
      .where(sql`${t.status} = 'open' and ${t.postId} is null`),
    check("reports_reason", inArray(t.reason, REPORT_REASONS).inlineParams()),
    check("reports_status", inArray(t.status, REPORT_STATUSES).inlineParams()),
    check(
      "reports_detail_length",
      sql`${t.detail} is null or length(${t.detail}) <= ${REPORT_DETAIL_MAX}`.inlineParams(),
    ),
  ],
);

/**
 * 投稿時の IP アドレス。発信者情報開示請求に備えて 90 日間保持し、期限切れはバッチが削除する。
 * API の応答には絶対に含めない。
 */
export const postIpLogs = snakeCase.table(
  "post_ip_logs",
  {
    postId: text()
      .primaryKey()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text().notNull(), // 外部キーなし。ユーザー行が消えても期限までは残す
    ipAddress: text().notNull(), // CF-Connecting-IP
    createdAt: createdAt(),
  },
  (t) => [index("post_ip_logs_created_idx").on(t.createdAt)],
);
