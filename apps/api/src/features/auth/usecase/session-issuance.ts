import { AuthError } from "@repo/errors/server";
import type { Database } from "../../../shared/db";
import { issueSession } from "../../../shared/auth/session-service";
import { maskIdentifier } from "../../../shared/logging/redaction";
import { createUserRecord } from "../../user/usecase";
import { getCtxOrError } from "../lib/encrypt-ctx";

type IssueSessionForFirebaseUserParams = {
  firebaseId: string;
  firebaseIdToken: string;
  firebaseRefreshToken: string;
  db: Database;
};

type IssuedSessionForFirebaseUser = {
  opaqueId: string;
  userId: string;
};

// Firebase認証成功後の共通フロー: ユーザーレコード作成 → 暗号化コンテキスト取得 → セッション発行。
// email/password サインイン・サインアップ・Google OAuth の3経路すべてがここに合流する。
export const issueSessionForFirebaseUser = async ({
  firebaseId,
  firebaseIdToken,
  firebaseRefreshToken,
  db,
}: IssueSessionForFirebaseUserParams): Promise<IssuedSessionForFirebaseUser | AuthError> => {
  // DBにユーザーレコード作成（先に作成、失敗時はセッションを発行しない）
  const userRecord = await createUserRecord({ firebaseId }, db);
  if (userRecord instanceof Error) return userRecord;

  // 暗号化コンテキスト取得
  const ctx = await getCtxOrError();
  if (ctx instanceof Error) return ctx;

  // サーバーセッションを発行
  const issued = await issueSession({
    firebaseIdToken,
    firebaseRefreshToken,
    userId: userRecord.id,
    db,
    ctx,
  });
  if (issued instanceof Error) {
    return new AuthError({
      message: issued.message,
      code: "session-issuance-failed",
      statusCode: 500,
      cause: issued,
    });
  }

  console.info("Session issued for Firebase user.", {
    firebaseId: maskIdentifier(firebaseId),
    userId: maskIdentifier(userRecord.id),
  });

  return { opaqueId: issued.opaqueId, userId: userRecord.id };
};
