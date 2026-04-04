import type { Context } from "hono";
import { env } from "hono/adapter";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ServerEnv } from "../server-env";

const SESSION_COOKIE_NAME = "otography_session";
export const SESSION_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 5;

const createSessionCookieOptions = (c: Context) => {
	const { AUTH_COOKIE_DOMAIN, NODE_ENV } = env<ServerEnv>(c);

	return {
		domain: AUTH_COOKIE_DOMAIN || undefined,
		httpOnly: true,
		maxAge: SESSION_COOKIE_MAX_AGE_MS / 1000,
		path: "/",
		sameSite: "Lax" as const,
		secure: NODE_ENV === "production",
	};
};

export const getSessionCookie = (c: Context) => {
	return getCookie(c, SESSION_COOKIE_NAME) ?? null;
};

export const setSessionCookie = (c: Context, sessionCookie: string) => {
	setCookie(c, SESSION_COOKIE_NAME, sessionCookie, createSessionCookieOptions(c));
};

export const clearSessionCookie = (c: Context) => {
	const { AUTH_COOKIE_DOMAIN } = env<ServerEnv>(c);

	deleteCookie(c, SESSION_COOKIE_NAME, {
		domain: AUTH_COOKIE_DOMAIN || undefined,
		path: "/",
	});
};
