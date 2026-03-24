import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { getEnv } from "../env";

const SESSION_COOKIE_NAME = "otography_session";
export const SESSION_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 5;

const createSessionCookieOptions = (c: Context) => {
	const env = getEnv(c);

	return {
		domain: env.AUTH_COOKIE_DOMAIN || undefined,
		httpOnly: true,
		maxAge: SESSION_COOKIE_MAX_AGE_MS / 1000,
		path: "/",
		sameSite: "Lax" as const,
		secure: env.NODE_ENV === "production",
	};
};

export const getSessionCookie = (c: Context) => {
	return getCookie(c, SESSION_COOKIE_NAME) ?? null;
};

export const setSessionCookie = (c: Context, sessionCookie: string) => {
	setCookie(c, SESSION_COOKIE_NAME, sessionCookie, createSessionCookieOptions(c));
};

export const clearSessionCookie = (c: Context) => {
	const env = getEnv(c);

	deleteCookie(c, SESSION_COOKIE_NAME, {
		domain: env.AUTH_COOKIE_DOMAIN || undefined,
		path: "/",
	});
};
