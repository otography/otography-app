import { type } from "arktype";
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "drizzle-orm";
import { firebaseAuth } from "../../shared/firebase-auth";
import { AuthError } from "@repo/errors/server";
import { signInWithIdp, signInWithPassword, signUpWithPassword } from "../../shared/firebase-rest";
import {
	buildOAuthFailureRedirect,
	buildOAuthSuccessRedirect,
	consumeOAuthState,
	createOAuthAuthorizationUrl,
	exchangeProviderAuthorizationCode,
	getFirebaseProviderId,
	getOAuthCallbackParams,
	getOAuthCallbackUrl,
	getOAuthProvider,
	getOAuthProviderErrorMessage,
} from "../../shared/oauth";
import {
	clearSessionCookie,
	SESSION_COOKIE_MAX_AGE_MS,
	setSessionCookie,
} from "../../shared/session";
import { withRls } from "../../shared/db/rls";
import { profileInsertSchema, profiles } from "../../shared/db/schema";
import { csrfProtection, getAuthSession, requireAuthMiddleware } from "../../shared/middleware";

const credentialsBodySchema = type({
	email: "string",
	password: "string",
});

const emailSchema = type("string.email");

const getStringClaim = (claims: Record<string, unknown>, key: string) => {
	const value = claims[key];
	return typeof value === "string" ? value : null;
};

const readCredentials = async (c: Context) => {
	const parsedBody = credentialsBodySchema(await c.req.json().catch(() => null));

	if (parsedBody instanceof type.errors) {
		return null;
	}

	const email = emailSchema(parsedBody.email.trim().toLowerCase());

	if (email instanceof type.errors || parsedBody.password.length < 6) {
		return null;
	}

	return {
		email,
		password: parsedBody.password,
	};
};

const issueSessionCookie = async (c: Context, idToken: string) => {
	const sessionCookie = await firebaseAuth
		.createSessionCookie(idToken, {
			expiresIn: SESSION_COOKIE_MAX_AGE_MS,
		})
		.catch((e) => AuthError.fromFirebase(e, "Failed to establish the authenticated session.", 502));
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

const finishOAuthBrowserAuth = async (c: Context, idToken: string, returnTo?: string) => {
	const sessionResult = await issueSessionCookie(c, idToken);
	if (sessionResult instanceof Error) {
		return c.redirect(buildOAuthFailureRedirect(c, sessionResult.message, returnTo), 302);
	}

	return c.redirect(buildOAuthSuccessRedirect(c, returnTo), 302);
};

// Handler functions
const oauthStartHandler = async (c: Context) => {
	const provider = getOAuthProvider(c.req.param("provider") ?? "");

	if (!provider) {
		return c.json({ message: "Unsupported OAuth provider." }, 404);
	}

	const authorizationUrl = await createOAuthAuthorizationUrl(c, provider);
	if (authorizationUrl instanceof Error) {
		return c.redirect(buildOAuthFailureRedirect(c, authorizationUrl.message), 302);
	}

	return c.redirect(authorizationUrl, 302);
};

const oauthCallbackHandler = async (c: Context) => {
	const provider = getOAuthProvider(c.req.param("provider") ?? "");

	if (!provider) {
		return c.json({ message: "Unsupported OAuth provider." }, 404);
	}

	const callbackParams = await getOAuthCallbackParams(c);

	if (callbackParams.error) {
		return c.redirect(
			buildOAuthFailureRedirect(c, getOAuthProviderErrorMessage(provider, callbackParams.error)),
			302,
		);
	}

	const oauthStateResult = await consumeOAuthState(c, provider, callbackParams.state);
	if (oauthStateResult instanceof Error) {
		return c.redirect(
			buildOAuthFailureRedirect(c, "The authentication session is invalid or expired."),
			302,
		);
	}
	const oauthState = oauthStateResult;

	if (!callbackParams.code) {
		return c.redirect(
			buildOAuthFailureRedirect(
				c,
				"The authentication provider did not return an authorization code.",
				oauthState.returnTo,
			),
			302,
		);
	}

	const exchangeResult = await exchangeProviderAuthorizationCode(c, provider, callbackParams.code);
	if (exchangeResult instanceof Error) {
		return c.redirect(
			buildOAuthFailureRedirect(c, exchangeResult.message, oauthState.returnTo),
			302,
		);
	}
	const providerIdToken = exchangeResult;

	const firebaseAuthResult = await signInWithIdp(
		c,
		`id_token=${encodeURIComponent(providerIdToken)}&providerId=${encodeURIComponent(getFirebaseProviderId(provider))}`,
		getOAuthCallbackUrl(c, provider),
	);

	if (firebaseAuthResult instanceof Error) {
		return c.redirect(
			buildOAuthFailureRedirect(c, firebaseAuthResult.message, oauthState.returnTo),
			302,
		);
	}

	return finishOAuthBrowserAuth(c, firebaseAuthResult.idToken, oauthState.returnTo);
};

const signInHandler = async (c: Context) => {
	const credentials = await readCredentials(c);

	if (!credentials) {
		return c.json(
			{
				message: "Please provide a valid email address and a password with at least 6 characters.",
			},
			400,
		);
	}

	const result = await signInWithPassword(c, credentials.email, credentials.password);

	if (result instanceof Error) {
		return c.json({ message: result.message }, result.statusCode);
	}

	return finishCredentialAuth(c, result.idToken, "Signed in successfully.", 200);
};

const signUpHandler = async (c: Context) => {
	const credentials = await readCredentials(c);

	if (!credentials) {
		return c.json(
			{
				message: "Please provide a valid email address and a password with at least 6 characters.",
			},
			400,
		);
	}

	const result = await signUpWithPassword(c, credentials.email, credentials.password);

	if (result instanceof Error) {
		return c.json({ message: result.message }, result.statusCode);
	}

	return finishCredentialAuth(c, result.idToken, "Account created successfully.", 201);
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

	const profileInput = profileInsertSchema({
		id: userId,
		email: getStringClaim(session, "email"),
		displayName: getStringClaim(session, "name"),
		photoUrl: getStringClaim(session, "picture"),
	});

	if (profileInput instanceof type.errors) {
		return c.json({ message: "Failed to normalize the current user profile." }, 500);
	}

	const rlsResult = await withRls(c, session, (tx) =>
		tx
			.insert(profiles)
			.values(profileInput)
			.onConflictDoUpdate({
				target: profiles.id,
				set: {
					email: getStringClaim(session, "email"),
					displayName: getStringClaim(session, "name"),
					photoUrl: getStringClaim(session, "picture"),
					updatedAt: sql`now()`,
				},
			})
			.returning(),
	);

	if (rlsResult instanceof Error) {
		return c.json({ message: rlsResult.message }, rlsResult.statusCode);
	}

	const [profile] = rlsResult;

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
			.catch((e) =>
				AuthError.fromFirebase(e, "Failed to revoke the Firebase refresh tokens.", 502),
			);

		if (revokeResult instanceof Error) {
			if (revokeResult.clearCookie) {
				clearSessionCookie(c);
				return c.body(null, 204);
			}

			return c.json({ message: revokeResult.message }, revokeResult.statusCode);
		}
	}

	clearSessionCookie(c);
	return c.body(null, 204);
};

// Chained routes for proper type inference
const auth = new Hono()
	.get("/api/auth/oauth/:provider/start", oauthStartHandler)
	.on(["GET", "POST"], "/api/auth/oauth/:provider/callback", oauthCallbackHandler)
	.post("/api/auth/sign-in", csrfProtection(), signInHandler)
	.post("/api/auth/sign-up", csrfProtection(), signUpHandler)
	.get("/api/user", requireAuthMiddleware(), userHandler)
	.post("/api/auth/sign-out", csrfProtection(), signOutHandler);

export { auth };
