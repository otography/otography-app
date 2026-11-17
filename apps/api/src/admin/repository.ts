import { postEmbeddings, reports, sessions, users, type ReportStatus } from "db";
import { eq, sql } from "drizzle-orm";
import type { Database } from "../lib/db.ts";
import { AdminQueryError } from "./errors.ts";

/** ユーザーが管理者か。 */
export const findIsAdmin = ({ db, userId }: { db: Database; userId: string }) =>
  db.query.users
    .findFirst({ where: { id: userId }, columns: { isAdmin: true } })
    .then((user) => user?.isAdmin ?? false)
    .catch((e) => new AdminQueryError({ cause: e }));

/** 状態ごとの通報を、新しい順に読む。 */
export const findReports = ({
  db,
  status,
  limit,
}: {
  db: Database;
  status: ReportStatus;
  limit: number;
}) =>
  db.query.reports
    .findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      limit,
      columns: { id: true, reason: true, detail: true, status: true, createdAt: true },
      with: {
        reporter: { columns: { publicId: true, name: true } },
        targetUser: { columns: { publicId: true, name: true, suspendedAt: true } },
        post: { columns: { id: true, content: true, hiddenAt: true, deletedAt: true } },
      },
    })
    .catch((e) => new AdminQueryError({ cause: e }));

/** 通報の状態を変える。変えた通報の ID を返し、通報が無ければ null を返す。 */
export const updateReportStatus = ({
  db,
  reportId,
  status,
}: {
  db: Database;
  reportId: string;
  status: Exclude<ReportStatus, "open">;
}) =>
  db
    .update(reports)
    .set({ status, resolvedAt: new Date() })
    .where(eq(reports.id, reportId))
    .returning({ id: reports.id })
    .then(([row]) => row?.id ?? null)
    .catch((e) => new AdminQueryError({ cause: e }));

/**
 * 投稿を非表示にする（hidden が true）か、非表示を解除する。非表示にするときは、埋め込みの行も消す。
 * 変えた投稿の ID を返し、投稿が無ければ null を返す。
 * Drizzle の update は updated_at を自動で更新する。非表示は投稿の内容の変更ではないので、SQL で書く。
 */
export const updatePostHidden = async ({
  db,
  postId,
  hidden,
}: {
  db: Database;
  postId: string;
  hidden: boolean;
}) => {
  const hiddenAt = hidden ? Date.now() : null;
  const update = db.all<{ id: string }>(
    sql`update posts set hidden_at = ${hiddenAt} where id = ${postId} returning id`,
  );
  const result = await (
    hidden
      ? db.batch([update, db.delete(postEmbeddings).where(eq(postEmbeddings.postId, postId))])
      : db.batch([update])
  ).catch((e) => new AdminQueryError({ cause: e }));
  if (result instanceof Error) return result;
  return result[0][0]?.id ?? null;
};

/**
 * ユーザーを停止する（suspended が true）か、停止を解除する。停止するときは、セッションをすべて消す。
 * 変えたユーザーの内部 ID を返し、ユーザーが無ければ null を返す。
 */
export const updateUserSuspended = async ({
  db,
  userId,
  suspended,
}: {
  db: Database;
  userId: string;
  suspended: boolean;
}) => {
  const update = db
    .update(users)
    .set({ suspendedAt: suspended ? new Date() : null })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  const result = await (
    suspended
      ? db.batch([update, db.delete(sessions).where(eq(sessions.userId, userId))])
      : db.batch([update])
  ).catch((e) => new AdminQueryError({ cause: e }));
  if (result instanceof Error) return result;
  return result[0][0]?.id ?? null;
};

/** 公開 ID のユーザーの内部 ID を読む（退会済みは除く）。 */
export const findUserIdByPublicId = ({ db, publicId }: { db: Database; publicId: string }) =>
  db.query.users
    .findFirst({ where: { publicId, deletedAt: { isNull: true } }, columns: { id: true } })
    .then((user) => user?.id ?? null)
    .catch((e) => new AdminQueryError({ cause: e }));
