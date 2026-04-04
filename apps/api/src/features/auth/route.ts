import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "drizzle-orm";
import { firebaseAuth } from "../../shared/firebase-auth";
import { AuthError } from "@repo/errors/server";
import { signInWithPassword, signUpWithPassword } from "../../shared/firebase-rest";
import {
	clearSessionCookie,
	SESSION_COOKIE_MAX_AGE_MS,
	setSessionCookie,
} from "../../shared/session";
import { getDb } from "../../shared/db";
import { users } from "../../shared/db/schema";
import { csrfProtection, getAuthSession, requireAuthMiddleware } from "../../shared/middleware";

const credentialsBodySchema = type({
	email: type.pipe(type("string.trim"), type("string.lower"), type("string.email")),
	password: "string >= 6",
});

const credentialsValidator = arktypeValidator("json", credentialsBodySchema, (result, c) => {
	if (!result.success) {
		return c.json(
			{
				message: "Please provide a valid email address and a password with at least 6 characters.",
			},
			400,
		);
	}
});

const getStringClaim = (claims: Record<string, unknown>, key: string) => {
	const value = claims[key];
	return typeof value === "string" ? value : null;
};

const issueSessionCookie = async (c: Context, idToken: string) => {
	const sessionCookie = await firebaseAuth
		.createSessionCookie(idToken, {
			expiresIn: SESSION_COOKIE_MAX_AGE_MS,
		})
		.catch((e) => AuthError.fromFirebase(e, "Session creation failed.", 502));
	if (sessionCookie instanceof Error) return sessionCookie;

	setSessionCookie(c, sessionCookie);
};

const finishCredentialAuth = async (
	c: Context,
	idToken: string,
	successMessage: string,
	successStatus: 200 | 201,
) => {
	const sessionResult = await issueSessionCookie(c, idToken);
	if (sessionResult instanceof Error) {
		return c.json({ message: sessionResult.message }, sessionResult.statusCode);
	}

	return c.json({ message: successMessage }, successStatus);
};

const normalizeUsername = (email: string | undefined, localId: string) => {
	const base = email?.split("@")[0]?.trim().toLowerCase() ?? `user_${localId}`;
	const normalized = base
		.replace(/[^a-z0-9_]/g, "_")
		.replace(/_+/g, "_")
		.slice(0, 50);
	const fallback = `user_${localId.slice(0, 12)}`;
	return normalized.length > 0 ? normalized : fallback;
};

const registerAppUser = async (c: Context, localId: string, email?: string) => {
	const db = getDb(c);
	const username = normalizeUsername(email, localId);

	const result = await db
		.insert(users)
		.values({
			firebaseId: localId,
			username,
		})
		.onConflictDoNothing({
			target: users.firebaseId,
		})
		.catch(() => new Error("Failed to create user record."));

	return result;
};

const handleCredentialAuth = async (
	c: Context,
	email: string,
	password: string,
	successMessage: string,
	successStatus: 200 | 201,
) => {
	const result =
		successStatus === 200
			? await signInWithPassword(c, email, password)
			: await signUpWithPassword(c, email, password);

	if (result instanceof Error) {
		return c.json({ message: result.message }, result.statusCode);
	}

	return finishCredentialAuth(c, result.idToken, successMessage, successStatus);
};

const signUpHandler = async (c: Context, email: string, password: string) => {
	const signUpResult = await signUpWithPassword(c, email, password);

	if (signUpResult instanceof Error) {
		return c.json({ message: signUpResult.message }, signUpResult.statusCode);
	}

	const registerResult = await registerAppUser(c, signUpResult.localId, signUpResult.email);
	if (registerResult instanceof Error) {
		return c.json({ message: "Failed to register user profile." }, 500);
	}

	return finishCredentialAuth(c, signUpResult.idToken, "Account created successfully.", 201);
};

const userHandler = async (c: Context) => {
	const session = getAuthSession(c);

	if (!session) {
		return c.json({ message: "You are not logged in." }, 401);
	}

	const userId = session.sub;

	if (!userId) {
		clearSessionCookie(c);
		return c.json({ message: "The current session is invalid." }, 401);
	}
	const email = getStringClaim(session, "email");
	const displayName = getStringClaim(session, "name");
	const photoUrl = getStringClaim(session, "picture");
	const db = getDb(c);

	const userResult = await db
		.insert(users)
		.values({
			firebaseId: userId,
			username: normalizeUsername(email ?? undefined, userId),
		})
		.onConflictDoUpdate({
			target: users.firebaseId,
			set: {
				updatedAt: sql`now()`,
			},
		})
		.returning()
		.catch(() => new Error("Failed to fetch user profile."));
	if (userResult instanceof Error) {
		return c.json({ message: "Failed to fetch user profile." }, 500);
	}

	const [user] = userResult;
	if (!user) {
		return c.json({ message: "Failed to fetch user profile." }, 500);
	}

	const profile = {
		id: user.firebaseId,
		email,
		displayName,
		photoUrl,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	};

	return c.json({
		message: "You are logged in!",
		profile,
		userId,
	});
};

const signOutHandler = async (c: Context) => {
	const session = getAuthSession(c);
	const userId = session?.sub ?? null;

	if (userId) {
		const revokeResult = await firebaseAuth
			.revokeRefreshTokens(userId)
			.catch((e) => AuthError.fromFirebase(e, "Failed to sign you out.", 502));

		if (revokeResult instanceof Error) {
			if (revokeResult.clearCookie) {
				clearSessionCookie(c);
				return c.body(null, 204);
			}

			return c.json(
				{ message: "Failed to sign you out. Please try again." },
				revokeResult.statusCode,
			);
		}
	}

	clearSessionCookie(c);
	return c.body(null, 204);
};

// Chained routes for proper type inference
const auth = new Hono()
	.post("/api/auth/sign-in", csrfProtection(), credentialsValidator, (c) => {
		const { email, password } = c.req.valid("json");
		return handleCredentialAuth(c, email, password, "Signed in successfully.", 200);
	})
	.post("/api/auth/sign-up", csrfProtection(), credentialsValidator, (c) => {
		const { email, password } = c.req.valid("json");
		return signUpHandler(c, email, password);
	})
	.get("/api/user", requireAuthMiddleware(), userHandler)
	.post("/api/auth/sign-out", csrfProtection(), signOutHandler);

export { auth };
