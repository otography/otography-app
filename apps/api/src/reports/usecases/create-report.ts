import type { z } from "zod";
import type { Database } from "../../lib/db.ts";
import { createPublicId } from "../../lib/id.ts";
import { ReportTargetNotFoundError, SelfReportError } from "../errors.ts";
import { findActiveUserId, findVisiblePostAuthorId, insertReport } from "../repository.ts";
import type { createReportInput } from "../schemas.ts";

/** 対象（投稿かユーザー）を確かめ、通報を保存する。投稿への通報には、投稿者も記録する。 */
export async function createReport({
  db,
  reporterId,
  input,
}: {
  db: Database;
  reporterId: string;
  input: z.output<typeof createReportInput>;
}) {
  const target =
    "postId" in input
      ? await findVisiblePostAuthorId({ db, postId: input.postId })
      : await findActiveUserId({ db, publicId: input.publicId });
  if (target instanceof Error) {
    return target;
  }
  if (target === null) {
    return new ReportTargetNotFoundError();
  }
  if (target === reporterId) {
    return new SelfReportError();
  }

  return insertReport({
    db,
    report: {
      id: createPublicId(),
      reporterId,
      postId: "postId" in input ? input.postId : null,
      targetUserId: target,
      reason: input.reason,
      detail: input.detail ?? null,
    },
  });
}
