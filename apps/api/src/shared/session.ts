import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

const SESSION_COOKIE_NAME = "otography_session";
export const SESSION_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 5;

const createSessionCookieOptions = (c: Context) => {
  return {
    domain: c.env.AUTH_COOKIE_DOMAIN || undefined,
    httpOnly: true,
    maxAge: SESSION_COOKIE_MAX_AGE_MS / 1000,
    path: "/",
    sameSite: "Lax" as const,
    secure: new URL(c.req.url).protocol === "https:",
  };
};

export const getSessionCookie = (c: Context) => {
  return getCookie(c, SESSION_COOKIE_NAME) ?? null;
};

export const setSessionCookie = (c: Context, sessionCookie: string) => {
  setCookie(c, SESSION_COOKIE_NAME, sessionCookie, createSessionCookieOptions(c));
};

export const clearSessionCookie = (c: Context) => {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    domain: c.env.AUTH_COOKIE_DOMAIN || undefined,
    path: "/",
  });
};
