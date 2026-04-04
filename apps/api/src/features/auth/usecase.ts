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
import { getAuthSession } from "../../shared/middleware";
import { insertUser, upsertUser } from "./repository";
import { normalizeUsername } from "./utils";

const issueSessionCookie = async (c: Context, idToken: string) => {
	const sessionCookie = await firebaseAuth
		.createSessionCookie(idToken, {
			expiresIn: SESSION_COOKIE_MAX_AGE_MS,
		})
		.catch((e) => {
			throw AuthError.fromFirebase(e, "Session creation failed.", 502);
		});

	setSessionCookie(c, sessionCookie);
};

const registerAppUser = async (c: Context, claims: DecodedIdToken, email?: string) => {
	const username = normalizeUsername(email, claims.sub);
	try {
		return await withRls(c, claims, async (tx) => {
			return insertUser(tx, { firebaseId: claims.sub, username });
		});
	} catch (e) {
		throw new AuthError({
			message: "Failed to create user record.",
			code: "registration-failed",
			statusCode: 500,
			cause: e,
		});
	}
};

export const signIn = async (c: Context, email: string, password: string) => {
	const result = await signInWithPassword(c, email, password);
	await issueSessionCookie(c, result.idToken);
	return c.json({ message: "Signed in successfully." }, 200);
};

export const signUp = async (c: Context, email: string, password: string) => {
	const signUpResult = await signUpWithPassword(c, email, password);

	// ID トークンを検証して DecodedIdToken を取得
	const claims = await firebaseAuth.verifyIdToken(signUpResult.idToken).catch(() => {
		throw new AuthError({
			message: "Failed to verify sign-up token.",
			code: "token-verification-failed",
			statusCode: 401,
		});
	});

	await registerAppUser(c, claims, signUpResult.email);
	await issueSessionCookie(c, signUpResult.idToken);

	return c.json({ message: "Account created successfully." }, 201);
};

export const getProfile = async (c: Context) => {
	const session = getAuthSession(c);
	if (!session) {
		return c.json({ message: "You are not logged in." }, 401);
	}

	const userId = session.sub;
	if (!userId) {
		throw new AuthError({
			message: "The current session is invalid.",
			code: "invalid-session",
			statusCode: 401,
			clearCookie: true,
		});
	}

	const email = session.email ?? null;
	const displayName = session.name ?? null;
	const photoUrl = session.picture ?? null;

	const userResult = await (async () => {
		try {
			return await withRls(c, session, async (tx) => {
				return upsertUser(tx, {
					firebaseId: userId,
					username: normalizeUsername(email ?? undefined, userId),
				});
			});
		} catch (e) {
			throw new AuthError({
				message: "Failed to fetch user profile.",
				code: "db-error",
				statusCode: 500,
				cause: e,
			});
		}
	})();

	const [user] = userResult;
	if (!user) {
		throw new AuthError({
			message: "Failed to fetch user profile.",
			code: "user-not-found",
			statusCode: 500,
		});
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

export const signOut = async (c: Context) => {
	const session = getAuthSession(c);
	const userId = session?.sub ?? null;

	if (userId) {
		const revokeResult = await firebaseAuth
			.revokeRefreshTokens(userId)
			.catch((e) => AuthError.fromFirebase(e, "Failed to sign you out.", 502));

		if (revokeResult instanceof Error) {
			// セッションが既に無効な場合はローカルでサインアウト成功とする
			if (revokeResult.clearCookie) {
				clearSessionCookie(c);
				return c.body(null, 204);
			}
			throw revokeResult;
		}
	}

	clearSessionCookie(c);
	return c.body(null, 204);
};
