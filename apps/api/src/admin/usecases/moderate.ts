import type { ReportStatus } from "db";
import type { Database } from "../../lib/db.ts";
import { AdminTargetNotFoundError, ReportNotFoundError, SelfSuspendError } from "../errors.ts";
import {
  findUserIdByPublicId,
  updatePostHidden,
  updateReportStatus,
  updateUserSuspended,
} from "../repository.ts";

/** 通報を処理済み（resolved）か却下（dismissed）にする。 */
export async function resolveReport({
  db,
  reportId,
  status,
}: {
  db: Database;
  reportId: string;
  status: Exclude<ReportStatus, "open">;
}) {
  const updated = await updateReportStatus({ db, reportId, status });
  if (updated instanceof Error) return updated;
  if (updated === null) return new ReportNotFoundError({ reportId });
  return { status };
}

/** 投稿を非表示にするか、非表示を解除する。削除済みの投稿にも設定できる。 */
export async function setPostHidden({
  db,
  postId,
  hidden,
}: {
  db: Database;
  postId: string;
  hidden: boolean;
}) {
  const updated = await updatePostHidden({ db, postId, hidden });
  if (updated instanceof Error) return updated;
  if (updated === null) return new AdminTargetNotFoundError({ kind: "投稿", id: postId });
  return { hidden };
}

/** ユーザーを停止するか、停止を解除する。停止すると、そのユーザーはログアウトする。自分自身は停止できない。 */
export async function setUserSuspended({
  db,
  adminId,
  publicId,
  suspended,
}: {
  db: Database;
  adminId: string;
  publicId: string;
  suspended: boolean;
}) {
  const userId = await findUserIdByPublicId({ db, publicId });
  if (userId instanceof Error) return userId;
  if (userId === null) return new AdminTargetNotFoundError({ kind: "ユーザー", id: publicId });
  if (userId === adminId) return new SelfSuspendError();

  const updated = await updateUserSuspended({ db, userId, suspended });
  if (updated instanceof Error) return updated;
  return { suspended };
}
