import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { firebaseAuth } from "../../shared/firebase-auth";
import { AuthError } from "@repo/errors/server";
import { signInWithPassword, signUpWithPassword } from "../../shared/firebase-rest";
import { SESSION_COOKIE_MAX_AGE_MS } from "../../shared/session";
import { withRls } from "../../shared/db/rls";
import { insertUser, upsertUser } from "./repository";
import { normalizeUsername } from "./utils";

const createSessionCookie = async (idToken: string) => {
	const sessionCookie = await firebaseAuth
		.createSessionCookie(idToken, {
			expiresIn: SESSION_COOKIE_MAX_AGE_MS,
		})
		.catch((e) => {
			throw AuthError.fromFirebase(e, "Session creation failed.", 502);
		});

	return sessionCookie;
};

const registerAppUser = async (claims: DecodedIdToken, email?: string) => {
	const username = normalizeUsername(email, claims.sub);
	try {
		return await withRls(claims, async (tx) => {
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

export const signIn = async (firebaseApiKey: string, email: string, password: string) => {
	const result = await signInWithPassword(firebaseApiKey, email, password);
	const sessionCookie = await createSessionCookie(result.idToken);
	return { sessionCookie };
};

export const signUp = async (firebaseApiKey: string, email: string, password: string) => {
	const signUpResult = await signUpWithPassword(firebaseApiKey, email, password);

	// ID トークンを検証して DecodedIdToken を取得
	const claims = await firebaseAuth.verifyIdToken(signUpResult.idToken).catch(() => {
		throw new AuthError({
			message: "Failed to verify sign-up token.",
			code: "token-verification-failed",
			statusCode: 401,
		});
	});

	await registerAppUser(claims, signUpResult.email);
	const sessionCookie = await createSessionCookie(signUpResult.idToken);

	return { sessionCookie };
};

export const getProfile = async (session: DecodedIdToken) => {
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
			return await withRls(session, async (tx) => {
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

	return {
		profile: {
			id: user.firebaseId,
			email,
			displayName,
			photoUrl,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		},
		userId,
	};
};

export const signOut = async (session: DecodedIdToken | null) => {
	const userId = session?.sub ?? null;

	if (userId) {
		const revokeResult = await firebaseAuth
			.revokeRefreshTokens(userId)
			.catch((e) => AuthError.fromFirebase(e, "Failed to sign you out.", 502));

		if (revokeResult instanceof Error) {
			// セッションが既に無効な場合はローカルでサインアウト成功とする
			if (revokeResult.clearCookie) {
				return { clearSession: true };
			}
			throw revokeResult;
		}
	}

	return { clearSession: true };
};
