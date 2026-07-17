import { createMiddleware } from "hono/factory";
import { verifySessionCookie, verifySessionCookieStrict } from "../firebase/firebase-admin";
import { clearSessionCookie, getSessionCookie } from "../auth/session-cookie";
import { handleRefreshResult, refreshSession } from "../auth/session-refresh";
import { respondWithError, unauthorizedResponse } from "../errors/error-response";
import type { Env } from "../types/env";

export const authSessionMiddleware = () =>
  createMiddleware<Env>(async (c, next) => {
    c.set("authSession", null);
    const sessionCookie = getSessionCookie(c);

    if (!sessionCookie) {
      await next();
      return;
    }

    const claims = await verifySessionCookie(sessionCookie);

    if (claims instanceof Error) {
      const refreshedClaims = await refreshSession(c);
      if (!handleRefreshResult(c, refreshedClaims) && claims.clearCookie) {
        clearSessionCookie(c);
      }

      await next();
      return;
    }

    const userId = claims?.sub;

    if (!userId) {
      await next();
      return;
    }

    c.set("authSession", claims);

    await next();
  });

export const requireAuthMiddleware = () =>
  createMiddleware<Env>(async (c, next) => {
    if (c.get("authSession")) {
      await next();
      return;
    }

    const sessionCookie = getSessionCookie(c);

    if (!sessionCookie) {
      // ブラウザが期限切れセッションcookieを削除した場合でも、
      // refresh token cookieがあれば自動リフレッシュを試行する
      const refreshedClaims = await refreshSession(c);
      if (handleRefreshResult(c, refreshedClaims)) {
        await next();
        return;
      }

      return unauthorizedResponse(c, "You are not logged in.");
    }

    const claims = await verifySessionCookie(sessionCookie);

    if (claims instanceof Error) {
      const refreshedClaims = await refreshSession(c);
      if (handleRefreshResult(c, refreshedClaims)) {
        await next();
        return;
      }

      // リフレッシュも失敗した場合、リフレッシュのエラーを優先して返す
      if (refreshedClaims instanceof Error) {
        return respondWithError(refreshedClaims, c);
      }

      if (claims.clearCookie) clearSessionCookie(c);

      return respondWithError(claims, c);
    }

    c.set("authSession", claims);
    await next();
  });

// センシティブ操作（アカウント削除など）用の per-route ミドルウェア。
// requireAuthMiddleware() の後段に置き、生クッキーを verifySessionCookieStrict で再検証する。
// ハンドラはキャッシュ済み claims（getAuthSession）しか見ないため、厳格検証で失効・無効化を確認する。
export const requireFreshSessionMiddleware = () =>
  createMiddleware<Env>(async (c, next) => {
    const sessionCookie = getSessionCookie(c);
    const authSession = c.get("authSession");

    // クッキーなし + authSession あり（refresh 経由で認証済み）→ 通過。
    // refresh token 交換自体が失効・無効化ユーザーで失敗するため fresh とみなせる。
    if (!sessionCookie) {
      if (authSession) {
        await next();
        return;
      }
      return unauthorizedResponse(c, "You are not logged in.");
    }

    const claims = await verifySessionCookieStrict(sessionCookie);

    if (claims instanceof Error) {
      // 厳格検証失敗 → refreshSession にフォールバック（期限切れクッキー + 有効な refresh token の救済）
      const refreshedClaims = await refreshSession(c);
      if (handleRefreshResult(c, refreshedClaims)) {
        await next();
        return;
      }

      // リフレッシュも失敗した場合、リフレッシュのエラーを優先して返す
      if (refreshedClaims instanceof Error) {
        return respondWithError(refreshedClaims, c);
      }

      if (claims.clearCookie) clearSessionCookie(c);

      return respondWithError(claims, c);
    }

    await next();
  });
