import type { Context, MiddlewareHandler } from "hono";
import { firebaseAuth } from "../firebase-auth";
import {
	getRequireAuthFailure,
	normalizeFirebaseAuthError,
	shouldClearSessionCookieForAuthError,
} from "../firebase-auth-error";
import { clearSessionCookie, getSessionCookie } from "../session";

const clearSessionContext = (c: Context) => {
	c.set("authSession", null);
	c.set("authSessionError", null);
	c.set("jwtPayload", null);
	c.set("userId", null);
};

export const getAuthSession = (c: Context) => {
	return c.get("authSession");
};

export const getAuthSessionError = (c: Context) => {
	return c.get("authSessionError");
};

export const authSessionMiddleware = (): MiddlewareHandler => {
	return async (c, next) => {
		clearSessionContext(c);
		const sessionCookie = getSessionCookie(c);

		if (!sessionCookie) {
			await next();
			return;
		}

		try {
			const claims = await firebaseAuth.verifySessionCookie(sessionCookie, true);
			const userId = typeof claims?.sub === "string" ? claims.sub : null;

			if (!userId) {
				c.set("jwtPayload", null);
				c.set("userId", null);
				await next();
				return;
			}

			c.set("authSession", {
				claims,
				sessionCookie,
			});
			c.set("jwtPayload", claims);
			c.set("userId", userId);
		} catch (error) {
			const authError = normalizeFirebaseAuthError(
				error,
				"Failed to verify the Firebase session cookie.",
			);
			c.set("authSessionError", authError);

			if (sessionCookie && shouldClearSessionCookieForAuthError(authError)) {
				clearSessionCookie(c);
			}
		}

		await next();
	};
};

export const requireAuth = (): MiddlewareHandler => {
	return async (c, next) => {
		const authSessionError = getAuthSessionError(c);

		if (authSessionError) {
			const failure = getRequireAuthFailure(authSessionError);
			return c.json(failure.body, failure.status);
		}

		if (!getAuthSession(c)) {
			return c.json({ message: "You are not logged in." }, 401);
		}

		await next();
	};
};
