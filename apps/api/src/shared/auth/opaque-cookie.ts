import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { getSessionCookieName } from "./cookies";
import { ABSOLUTE_TIMEOUT_MS } from "./session-config";

// セッションCookieの maxAge（秒）
const SESSION_COOKIE_MAX_AGE_S = ABSOLUTE_TIMEOUT_MS / 1000;

// リクエストがHTTPS経由かを判定
const isSecureRequest = (c: Context): boolean => new URL(c.req.url).protocol === "https:";

// セッションCookieの属性を構築
const createSessionCookieOptions = (isSecure: boolean) => ({
  // __Host- プレフィックス付きCookieは Domain 属性を禁止
  httpOnly: true,
  secure: isSecure,
  sameSite: "Strict" as const,
  path: "/",
  maxAge: SESSION_COOKIE_MAX_AGE_S,
});

// オペークセッションCookieからIDを取得
export const getOpaqueSessionId = (c: Context): string | null => {
  const isSecure = isSecureRequest(c);
  const cookieName = getSessionCookieName(isSecure);
  return getCookie(c, cookieName) ?? null;
};

// オペークセッションCookieを設定
export const setOpaqueSessionCookie = (c: Context, opaqueId: string): void => {
  const isSecure = isSecureRequest(c);
  const cookieName = getSessionCookieName(isSecure);
  setCookie(c, cookieName, opaqueId, createSessionCookieOptions(isSecure));
};

// オペークセッションCookieを削除
export const clearOpaqueSessionCookie = (c: Context): void => {
  const isSecure = isSecureRequest(c);
  const cookieName = getSessionCookieName(isSecure);
  deleteCookie(c, cookieName, { path: "/" });
};
