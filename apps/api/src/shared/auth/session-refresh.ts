import type { Context } from "hono";
import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import type { AuthError } from "@repo/errors/server";
import type { AuthRestError } from "@repo/errors";
import { verifySessionCookie, createSessionCookie } from "../firebase/firebase-admin";
import { exchangeRefreshToken } from "../firebase/firebase-token-exchange";
import { clearSessionCookie, setSessionCookie } from "./session-cookie";
import {
  clearRefreshTokenCookie,
  getRefreshTokenCookie,
  setRefreshTokenCookie,
} from "./refresh-token";

// セッションクッキーの検証に失敗した場合、refresh tokenを使って
// 新しいセッションクッキーを自動的に発行する。
// null: refresh token cookieなし（期待される不在）
// Error: リフレッシュ失敗
// DecodedIdToken: リフレッシュ成功
export const refreshSession = async (
  c: Context,
): Promise<DecodedIdToken | AuthError | AuthRestError | null> => {
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

export const handleRefreshResult = (
  c: Context,
  refreshedClaims: DecodedIdToken | AuthError | AuthRestError | null,
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
