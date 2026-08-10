import { AuthError } from "@repo/errors/server";
import type { Database } from "../db";
import { revokeSession } from "./session-repository";

// セッション終端エラーを AuthError に変換（clearCookie 付き）
export const terminalSessionError = (message: string, code: string, cause?: unknown): AuthError =>
  new AuthError({
    message,
    code,
    statusCode: 401,
    clearCookie: true,
    problemSlug: "session-invalid",
    ...(cause !== undefined ? { cause } : {}),
  });

// セッションを無効化し、エラーをログに記録する（ベストエフォート）
export const safeRevokeSession = async (
  db: Database,
  sessionId: string,
  context: string,
): Promise<void> => {
  const result = await revokeSession(db, sessionId);
  if (result instanceof Error) {
    console.warn(`${context} 後のセッション無効化に失敗しました。`, { message: result.message });
  }
};
