import type { Context } from "hono";
import { AuthRestError } from "@repo/errors";
import { AuthError } from "@repo/errors/server";
import { clearOpaqueSessionCookie } from "../../../shared/auth/opaque-cookie";
import { errorLogFields } from "../../../shared/logging/log-format";
import { respondWithError } from "../../../shared/errors/error-response";
import type { Env } from "../../../shared/types/env";

// authルート共通のエラーレスポンス整形。
// 5xxはサーバー側でログし、clearCookie指定があればオペークセッションCookieを削除する。
export const handleAuthError = (error: AuthError | AuthRestError, c: Context<Env>) => {
  if (error.statusCode >= 500) {
    console.error("Auth request failed.", errorLogFields(error));
  }

  if ("clearCookie" in error && error.clearCookie) {
    clearOpaqueSessionCookie(c);
  }

  return respondWithError(error, c);
};
