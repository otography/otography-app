import { AuthError } from "@repo/errors/server";
import { getEncryptCtx } from "../../../shared/auth/key-ring-loader";

// 暗号化コンテキストを取得（失敗時はエラーレスポンス用のAuthErrorに変換）
export const getCtxOrError = async () => {
  const ctx = await getEncryptCtx();
  if (ctx instanceof Error) {
    console.error("暗号化コンテキストの初期化に失敗しました。", { message: ctx.message });
    return new AuthError({
      message: "Session encryption not configured.",
      code: "encryption-config-error",
      statusCode: 500,
      cause: ctx,
    });
  }
  return ctx;
};
