import type { MiddlewareHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { verifySessionCookie } from "../firebase/firebase-admin";
import { clearSessionCookie, getSessionCookie } from "../auth/session-cookie";
import { handleRefreshResult, refreshSession } from "../auth/session-refresh";
import { formatErrorResponse } from "../errors/error-response";

/**
 * RFC 7807 Problem Details 形式のエラーレスポンスを返すヘルパー
 */
const problemJson = (
  c: Parameters<MiddlewareHandler>[0],
  status: ContentfulStatusCode,
  typeSlug: string,
  title: string,
  detail: string,
) => {
  return c.body(
    JSON.stringify({
      type: `https://api.otography.com/errors/${typeSlug}`,
      title,
      status,
      detail,
    }),
    status,
    { "Content-Type": "application/problem+json" },
  );
};

export const authSessionMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
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
  };
};

export const requireAuthMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
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

      return problemJson(c, 401, "unauthorized", "Unauthorized", "You are not logged in.");
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
        const { body, statusCode } = formatErrorResponse(refreshedClaims);
        return c.body(JSON.stringify(body), statusCode, {
          "Content-Type": "application/problem+json",
        });
      }

      if (claims.clearCookie) clearSessionCookie(c);

      const { body, statusCode } = formatErrorResponse(claims);
      return c.body(JSON.stringify(body), statusCode, {
        "Content-Type": "application/problem+json",
      });
    }

    c.set("authSession", claims);
    await next();
  };
};
