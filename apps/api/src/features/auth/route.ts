import { type } from "arktype";
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "drizzle-orm";
import { firebaseAuth } from "../../shared/firebase-auth";
import {
	getServerSignOutFailure,
	getSessionCookieIssuanceFailure,
	normalizeFirebaseAuthError,
	shouldClearSessionCookieForAuthError,
} from "../../shared/firebase-auth-error";
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
import {
	csrfProtection,
	getAuthSession,
	getAuthSessionError,
	requireAuth,
} from "../../shared/middleware";

const auth = new Hono();

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
	const sessionCookie = await firebaseAuth.createSessionCookie(idToken, {
		expiresIn: SESSION_COOKIE_MAX_AGE_MS,
	});

	setSessionCookie(c, sessionCookie);
};

const finishCredentialAuth = async (
	c: Context,
	idToken: string,
	successMessage: string,
	successStatus: 200 | 201,
) => {
	try {
		await issueSessionCookie(c, idToken);
	} catch (error) {
		const authError = normalizeFirebaseAuthError(
			error,
			"Failed to establish the authenticated session.",
		);
		const failure = getSessionCookieIssuanceFailure(authError);
		return c.json(failure.body, failure.status);
	}

	return c.json({ message: successMessage }, successStatus);
};

const finishOAuthBrowserAuth = async (c: Context, idToken: string, returnTo?: string) => {
	try {
		await issueSessionCookie(c, idToken);
	} catch (error) {
		const authError = normalizeFirebaseAuthError(
			error,
			"Failed to establish the authenticated session.",
		);
		const failure = getSessionCookieIssuanceFailure(authError);
		return c.redirect(buildOAuthFailureRedirect(c, failure.body.message, returnTo), 302);
	}

	return c.redirect(buildOAuthSuccessRedirect(c, returnTo), 302);
};

auth.get("/api/auth/oauth/:provider/start", async (c) => {
	const provider = getOAuthProvider(c.req.param("provider"));

	if (!provider) {
		return c.json({ message: "Unsupported OAuth provider." }, 404);
	}

	try {
		const authorizationUrl = await createOAuthAuthorizationUrl(c, provider);
		return c.redirect(authorizationUrl, 302);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to start third-party authentication.";
		return c.redirect(buildOAuthFailureRedirect(c, message), 302);
	}
});

auth.on(["GET", "POST"], "/api/auth/oauth/:provider/callback", async (c) => {
	const provider = getOAuthProvider(c.req.param("provider"));

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

	let oauthState: { returnTo?: string };

	try {
		oauthState = await consumeOAuthState(c, provider, callbackParams.state);
	} catch {
		return c.redirect(
			buildOAuthFailureRedirect(c, "The authentication session is invalid or expired."),
			302,
		);
	}

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

	let providerIdToken: string;

	try {
		providerIdToken = await exchangeProviderAuthorizationCode(c, provider, callbackParams.code);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to complete third-party authentication.";
		return c.redirect(buildOAuthFailureRedirect(c, message, oauthState.returnTo), 302);
	}

	const firebaseAuthResult = await signInWithIdp(
		c,
		`id_token=${encodeURIComponent(providerIdToken)}&providerId=${encodeURIComponent(getFirebaseProviderId(provider))}`,
		getOAuthCallbackUrl(c, provider),
	);

	if ("status" in firebaseAuthResult) {
		return c.redirect(
			buildOAuthFailureRedirect(c, firebaseAuthResult.message, oauthState.returnTo),
			302,
		);
	}

	return finishOAuthBrowserAuth(c, firebaseAuthResult.idToken, oauthState.returnTo);
});

auth.post("/api/auth/sign-in", csrfProtection(), async (c) => {
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

	if ("status" in result) {
		return c.json({ message: result.message }, result.status);
	}

	return finishCredentialAuth(c, result.idToken, "Signed in successfully.", 200);
});

auth.post("/api/auth/sign-up", csrfProtection(), async (c) => {
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

	if ("status" in result) {
		return c.json({ message: result.message }, result.status);
	}

	return finishCredentialAuth(c, result.idToken, "Account created successfully.", 201);
});

auth.get("/api/user", requireAuth(), async (c) => {
	const session = getAuthSession(c);

	if (!session) {
		return c.json({ message: "You are not logged in." }, 401);
	}

	const userId = typeof session.claims.sub === "string" ? session.claims.sub : null;

	if (!userId) {
		clearSessionCookie(c);
		return c.json({ message: "The current session is invalid." }, 401);
	}

	const profileInput = profileInsertSchema({
		id: userId,
		email: getStringClaim(session.claims, "email"),
		displayName: getStringClaim(session.claims, "name"),
		photoUrl: getStringClaim(session.claims, "picture"),
	});

	if (profileInput instanceof type.errors) {
		return c.json({ message: "Failed to normalize the current user profile." }, 500);
	}

	const [profile] = await withRls(c, session.claims, (tx) =>
		tx
			.insert(profiles)
			.values(profileInput)
			.onConflictDoUpdate({
				target: profiles.id,
				set: {
					email: getStringClaim(session.claims, "email"),
					displayName: getStringClaim(session.claims, "name"),
					photoUrl: getStringClaim(session.claims, "picture"),
					updatedAt: sql`now()`,
				},
			})
			.returning(),
	);

	return c.json({
		message: "You are logged in!",
		profile,
		userId,
	});
});

auth.post("/api/auth/sign-out", csrfProtection(), async (c) => {
	const authSessionError = getAuthSessionError(c);

	if (authSessionError) {
		if (shouldClearSessionCookieForAuthError(authSessionError)) {
			clearSessionCookie(c);
			return c.body(null, 204);
		}

		const failure = getServerSignOutFailure(authSessionError);
		return c.json(failure.body, failure.status);
	}

	const session = getAuthSession(c);
	const userId = typeof session?.claims.sub === "string" ? session.claims.sub : null;

	if (userId) {
		try {
			await firebaseAuth.revokeRefreshTokens(userId);
		} catch (error) {
			const authError = normalizeFirebaseAuthError(
				error,
				"Failed to revoke the Firebase refresh tokens.",
			);

			if (shouldClearSessionCookieForAuthError(authError)) {
				clearSessionCookie(c);
				return c.body(null, 204);
			}

			const failure = getServerSignOutFailure(authError);
			return c.json(failure.body, failure.status);
		}
	}

	clearSessionCookie(c);
	return c.body(null, 204);
});

export { auth };
