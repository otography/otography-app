import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { firebaseAuth } from "../../shared/firebase-auth";
import { AuthError } from "@repo/errors/server";
import { signInWithPassword, signUpWithPassword } from "../../shared/firebase-rest";
import {
	clearSessionCookie,
	SESSION_COOKIE_MAX_AGE_MS,
	setSessionCookie,
} from "../../shared/session";
import { withRls } from "../../shared/db/rls";
import { csrfProtection, getAuthSession, requireAuthMiddleware } from "../../shared/middleware";
import { insertUser, upsertUser } from "./repository";
import { normalizeUsername } from "./utils";

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

const issueSessionCookie = async (c: Context, idToken: string) => {
	const sessionCookie = await firebaseAuth
		.createSessionCookie(idToken, {
			expiresIn: SESSION_COOKIE_MAX_AGE_MS,
		})
		.catch((e) => AuthError.fromFirebase(e, "Session creation failed.", 502));
	if (sessionCookie instanceof Error) return sessionCookie;

	setSessionCookie(c, sessionCookie);
};

const registerAppUser = async (c: Context, claims: DecodedIdToken, email?: string) => {
	const username = normalizeUsername(email, claims.sub);

	const result = await withRls(c, claims, async (tx) => {
		return insertUser(tx, { firebaseId: claims.sub, username });
	});

	if (result instanceof Error) {
		return new Error("Failed to create user record.");
	}

	return result;
};

const signInHandler = async (c: Context, email: string, password: string) => {
	const result = await signInWithPassword(c, email, password);
	if (result instanceof Error) {
		return c.json({ message: result.message }, result.statusCode);
	}

	const sessionResult = await issueSessionCookie(c, result.idToken);
	if (sessionResult instanceof Error) {
		return c.json({ message: sessionResult.message }, sessionResult.statusCode);
	}

	return c.json({ message: "Signed in successfully." }, 200);
};

const signUpHandler = async (c: Context, email: string, password: string) => {
	const signUpResult = await signUpWithPassword(c, email, password);
	if (signUpResult instanceof Error) {
		return c.json({ message: signUpResult.message }, signUpResult.statusCode);
	}

	// ID トークンを検証して DecodedIdToken を取得
	const claims = await firebaseAuth
		.verifyIdToken(signUpResult.idToken)
		.catch(() => new Error("Failed to verify sign-up token."));
	if (claims instanceof Error) {
		return c.json({ message: claims.message }, 401);
	}

	const registerResult = await registerAppUser(c, claims, signUpResult.email);
	if (registerResult instanceof Error) {
		return c.json({ message: "Failed to register user profile." }, 500);
	}

	const sessionResult = await issueSessionCookie(c, signUpResult.idToken);
	if (sessionResult instanceof Error) {
		return c.json({ message: sessionResult.message }, sessionResult.statusCode);
	}

	return c.json({ message: "Account created successfully." }, 201);
};

const getProfileHandler = async (c: Context) => {
	const session = getAuthSession(c);
	if (!session) {
		return c.json({ message: "You are not logged in." }, 401);
	}

	const userId = session.sub;
	if (!userId) {
		clearSessionCookie(c);
		return c.json({ message: "The current session is invalid." }, 401);
	}

	const email = session.email ?? null;
	const displayName = session.name ?? null;
	const photoUrl = session.picture ?? null;

	const userResult = await withRls(c, session, async (tx) => {
		return upsertUser(tx, {
			firebaseId: userId,
			username: normalizeUsername(email ?? undefined, userId),
		});
	});

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
		return signInHandler(c, email, password);
	})
	.post("/api/auth/sign-up", csrfProtection(), credentialsValidator, (c) => {
		const { email, password } = c.req.valid("json");
		return signUpHandler(c, email, password);
	})
	.get("/api/user", requireAuthMiddleware(), getProfileHandler)
	.post("/api/auth/sign-out", csrfProtection(), signOutHandler);

export { auth };
