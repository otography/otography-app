import type { Context, MiddlewareHandler } from "hono";
import { firebaseAuth } from "../firebase-auth";
import { AuthError } from "@repo/errors/server";
import { clearSessionCookie, getSessionCookie } from "../session";

const clearSessionContext = (c: Context) => {
	c.set("authSession", null);
};

export const getAuthSession = (c: Context) => {
	return c.get("authSession");
};

export const authSessionMiddleware = (): MiddlewareHandler => {
	return async (c, next) => {
		clearSessionContext(c);
		const sessionCookie = getSessionCookie(c);

		if (!sessionCookie) {
			await next();
			return;
		}

		const claims = await firebaseAuth
			.verifySessionCookie(sessionCookie, true)
			.catch((e) => AuthError.fromFirebase(e, "Failed to verify the Firebase session cookie."));

		if (claims instanceof Error) {
			if (sessionCookie && claims.clearCookie) {
				clearSessionCookie(c);
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

export const requireAuth = (): MiddlewareHandler => {
	return async (c, next) => {
		if (!getAuthSession(c)) {
			return c.json({ message: "You are not logged in." }, 401);
		}

		await next();
	};
};
