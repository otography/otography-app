import { reports } from "db";
import type { Database } from "../lib/db.ts";
import { ReportQueryError } from "./errors.ts";

type NewReport = typeof reports.$inferInsert;

/** 見せてよい投稿の投稿者の内部 ID を読む。投稿が無い・削除・非表示なら null。 */
export const findVisiblePostAuthorId = ({ db, postId }: { db: Database; postId: string }) =>
  db.query.posts
    .findFirst({
      where: {
        id: postId,
        deletedAt: { isNull: true },
        hiddenAt: { isNull: true },
        author: { suspendedAt: { isNull: true }, deletedAt: { isNull: true } },
      },
      columns: { userId: true },
    })
    .then((post) => post?.userId ?? null)
    .catch((e) => new ReportQueryError({ cause: e }));

/** 公開 ID のユーザーの内部 ID を読む。利用停止中・退会済みなら null。 */
export const findActiveUserId = ({ db, publicId }: { db: Database; publicId: string }) =>
  db.query.users
    .findFirst({
      where: { publicId, suspendedAt: { isNull: true }, deletedAt: { isNull: true } },
      columns: { id: true },
    })
    .then((user) => user?.id ?? null)
    .catch((e) => new ReportQueryError({ cause: e }));

/**
 * 通報を保存する。同じ人が同じ対象を未処理のまま通報済みなら、保存せずに成功として扱う
 * （reports_open_*_unique の部分インデックス）。
 */
export const insertReport = ({ db, report }: { db: Database; report: NewReport }) =>
  db
    .insert(reports)
    .values(report)
    .onConflictDoNothing()
    .then(() => null)
    .catch((e) => new ReportQueryError({ cause: e }));
