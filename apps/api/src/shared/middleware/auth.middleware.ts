import type { MiddlewareHandler } from "hono";
import { verifySessionCookie } from "../firebase/firebase-admin";
import { clearSessionCookie, getSessionCookie } from "../auth/session-cookie";
import { handleRefreshResult, refreshSession } from "../auth/session-refresh";

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
      if (claims.clearCookie) clearSessionCookie(c);

      const refreshedClaims = await refreshSession(c);
      handleRefreshResult(c, refreshedClaims);

      await next();
      return;
    }

    const userId = typeof claims?.sub === "string" ? claims.sub : null;

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

      return c.json({ message: "You are not logged in." }, 401);
    }

    const claims = await verifySessionCookie(sessionCookie);

    if (claims instanceof Error) {
      if (claims.clearCookie) clearSessionCookie(c);

      const refreshedClaims = await refreshSession(c);
      if (handleRefreshResult(c, refreshedClaims)) {
        await next();
        return;
      }

      // リフレッシュも失敗した場合、リフレッシュのエラーを優先して返す
      if (refreshedClaims instanceof Error) {
        return c.json({ message: refreshedClaims.message }, refreshedClaims.statusCode);
      }

      return c.json({ message: claims.message }, claims.statusCode);
    }

    c.set("authSession", claims);
    await next();
  };
};
