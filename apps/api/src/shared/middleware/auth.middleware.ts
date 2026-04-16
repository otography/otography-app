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
// null: refresh token cookieなし（期待される不在）
// Error: リフレッシュ失敗
// DecodedIdToken: リフレッシュ成功
const refreshSession = async (c: Context): Promise<DecodedIdToken | Error | null> => {
  const refreshToken = await getRefreshTokenCookie(c);
  if (!refreshToken) return null;

  const exchangeResult = await exchangeRefreshToken(c.env.FIREBASE_API_KEY, refreshToken);
  if (exchangeResult instanceof Error) return exchangeResult;

  const sessionCookie = await createSessionCookie(exchangeResult.id_token);
  if (sessionCookie instanceof Error) return sessionCookie;

  const claims = await verifySessionCookie(sessionCookie);
  if (claims instanceof Error) return claims;

  setSessionCookie(c, sessionCookie);
  await setRefreshTokenCookie(c, exchangeResult.refresh_token);

  return claims;
};

const handleRefreshResult = (
  c: Context,
  refreshedClaims: DecodedIdToken | Error | null,
): refreshedClaims is DecodedIdToken => {
  if (refreshedClaims instanceof Error) {
    clearSessionCookie(c);
    clearRefreshTokenCookie(c);
    console.warn("Session refresh failed:", refreshedClaims.message);
    return false;
  }
  if (!refreshedClaims) return false;
  if (typeof refreshedClaims.sub !== "string") return false;
  c.set("authSession", refreshedClaims);
  return true;
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

      handleRefreshResult(c, await refreshSession(c));

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

      if (handleRefreshResult(c, await refreshSession(c))) {
        await next();
        return;
      }

      return c.json({ message: claims.message }, claims.statusCode);
    }

    c.set("authSession", claims);
    await next();
  };
};
