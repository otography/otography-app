import { AuthError } from "@repo/errors/server";
import type { Database } from "../../../shared/db";
import { revokeSession } from "../../../shared/auth/session-repository";

type SignOutParams = {
  db: Database;
  sessionId: string;
};

// サインアウト: 現在のデバイスのサーバーセッションのみを無効化する（#2）。
// Firebase のグローバルな revokeRefreshTokens は呼ばない（アカウント削除/sign-out-all のみ）。
export const signOut = async ({ db, sessionId }: SignOutParams): Promise<true | Error> => {
  const revokeResult = await revokeSession(db, sessionId);
  if (revokeResult instanceof Error) {
    console.error("サインアウト時のセッション無効化に失敗しました。", {
      message: revokeResult.message,
    });
    return new AuthError({
      message: "Failed to sign out.",
      code: "session-revocation-failed",
      statusCode: 500,
      cause: revokeResult,
    });
  }

  return true;
};
