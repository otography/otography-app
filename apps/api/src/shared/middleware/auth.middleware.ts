import type { Context, MiddlewareHandler } from "hono";
import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { verifySessionCookie, createSessionCookie } from "../firebase-auth";
import { exchangeRefreshToken } from "../firebase-token-exchange";
import { clearSessionCookie, getSessionCookie, setSessionCookie } from "../session";
import {
  clearRefreshTokenCookie,
  getRefreshTokenCookie,
  setRefreshTokenCookie,
} from "../refresh-token";

export const getAuthSession = (c: Context) => {
  return c.get("authSession");
};

// セッションクッキーの検証に失敗した場合、refresh tokenを使って
// 新しいセッションクッキーを自動的に発行する。
// 成功すればclaimsを返し、失敗すればErrorを返す。
const refreshSession = async (c: Context): Promise<DecodedIdToken | null> => {
  const refreshToken = await getRefreshTokenCookie(c);
  if (!refreshToken) return null;

  const exchangeResult = await exchangeRefreshToken(c.env.FIREBASE_API_KEY, refreshToken);
  if (exchangeResult instanceof Error) {
    // refresh tokenも無効 → セッション完全に失効
    clearSessionCookie(c);
    clearRefreshTokenCookie(c);
    return null;
  }

  const sessionCookie = await createSessionCookie(exchangeResult.id_token);
  if (sessionCookie instanceof Error) {
    clearSessionCookie(c);
    clearRefreshTokenCookie(c);
    return null;
  }

  setSessionCookie(c, sessionCookie);
  await setRefreshTokenCookie(c, exchangeResult.refresh_token);

  // 新しいセッションクッキーを検証してclaimsを取得
  const claims = await verifySessionCookie(sessionCookie);
  if (claims instanceof Error) {
    return null;
  }

  return claims;
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
      if (claims.clearCookie) clearSessionCookie(c);

      // セッション期限切れ時に自動リフレッシュを試行
      const refreshedClaims = await refreshSession(c);
      if (refreshedClaims) {
        const userId = typeof refreshedClaims?.sub === "string" ? refreshedClaims.sub : null;
        if (userId) {
          c.set("authSession", refreshedClaims);
        }
      }

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
      return c.json({ message: "You are not logged in." }, 401);
    }

    const claims = await verifySessionCookie(sessionCookie);

    if (claims instanceof Error) {
      if (claims.clearCookie) clearSessionCookie(c);

      // セッション期限切れ時に自動リフレッシュを試行
      const refreshedClaims = await refreshSession(c);
      if (refreshedClaims) {
        c.set("authSession", refreshedClaims);
        await next();
        return;
      }

      return c.json({ message: claims.message }, claims.statusCode);
    }

    c.set("authSession", claims);
    await next();
  };
};
