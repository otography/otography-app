import { index, snakeCase, text } from "drizzle-orm/sqlite-core";
import { REPORT_STATUSES } from "../constants.ts";
import { users } from "./auth.ts";
import { createdAt, timestamp } from "./columns.ts";
import { posts } from "./posts.ts";

/** 通報。対象は投稿かユーザー（お気に入りのコメントはユーザーへの通報で扱う）。 */
export const reports = snakeCase.table(
  "reports",
  {
    id: text().primaryKey(),
    reporterId: text().references(() => users.id, { onDelete: "set null" }),
    postId: text().references(() => posts.id, { onDelete: "set null" }),
    targetUserId: text().references(() => users.id, { onDelete: "set null" }),
    reason: text().notNull(),
    detail: text(),
    status: text({ enum: REPORT_STATUSES }).notNull().default("open"),
    createdAt: createdAt(),
    resolvedAt: timestamp(),
  },
  (t) => [
    index("reports_status_created_idx").on(t.status, t.createdAt),
    index("reports_post_idx").on(t.postId),
    index("reports_target_user_idx").on(t.targetUserId),
    index("reports_reporter_idx").on(t.reporterId),
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
