import type { ErrorHandler } from "hono";
import { clearOpaqueSessionCookie } from "../auth/opaque-cookie";
import { createProblemInstance, formatErrorResponse } from "./error-response";
import { logError } from "../logging/structured-log";
import type { Env } from "../types/env";

// グローバルエラーハンドラー: 全エラーを RFC 9457 Problem Details に変換し、
// clearCookie フラグ付きエラーではセッションCookieを削除する。
// auth/route.ts や auth.middleware.ts と同じ clearOpaqueSessionCookie を使うことで
// 設定時と削除時の属性（path 等）を一貫させる。
export const globalErrorHandler: ErrorHandler<Env> = (err, c) => {
  logError(err, c.req.path);
  const { body, statusCode, clearCookie } = formatErrorResponse(err, {
    instance: createProblemInstance(),
  });

  if (clearCookie) {
    clearOpaqueSessionCookie(c);
  }

  return c.body(JSON.stringify(body), statusCode, {
    "Content-Type": "application/problem+json",
  });
};
