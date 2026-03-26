import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { SignJWT, importPKCS8, jwtVerify } from "jose";
import type { Context } from "hono";
import { OAuthConfigError, OAuthExchangeError, OAuthStateError } from "@repo/errors";
import { getEnv } from "../env";

const GOOGLE_AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPE = "openid email profile";

const APPLE_AUDIENCE = "https://appleid.apple.com";
const APPLE_AUTHORIZE_ENDPOINT = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_ENDPOINT = "https://appleid.apple.com/auth/token";
const APPLE_SCOPE = "name email";

const OAUTH_STATE_COOKIE_MAX_AGE_SECONDS = 60 * 10;

const textEncoder = new TextEncoder();

type OAuthProvider = "apple" | "google";

type OAuthStatePayload = {
	provider: OAuthProvider;
	returnTo?: string;
	state: string;
};

type GoogleTokenResponse = {
	error?: string;
	error_description?: string;
	id_token?: string;
};

type AppleTokenResponse = {
	error?: string;
	error_description?: string;
	id_token?: string;
};

const isNonEmptyString = (value: unknown): value is string => {
	return typeof value === "string" && value.length > 0;
};

const isGoogleTokenResponse = (value: unknown): value is GoogleTokenResponse => {
	return typeof value === "object" && value !== null;
};

const isAppleTokenResponse = (value: unknown): value is AppleTokenResponse => {
	return typeof value === "object" && value !== null;
};

const normalizeReturnTo = (value: string | null | undefined) => {
	if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
		return undefined;
	}

	return value;
};

const getOAuthStateCookieName = (provider: OAuthProvider) => {
	return `otography_oauth_state_${provider}`;
};

const getOAuthCookieOptions = (c: Context) => {
	const env = getEnv(c);

	return {
		domain: env.AUTH_COOKIE_DOMAIN || undefined,
		httpOnly: true,
		maxAge: OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
		path: "/api/auth/oauth",
		sameSite: "Lax" as const,
		secure: env.NODE_ENV === "production",
	};
};

const getOAuthStateSecret = (c: Context): OAuthConfigError | Uint8Array => {
	const env = getEnv(c);

	if (!env.AUTH_OAUTH_STATE_SECRET) {
		return new OAuthConfigError({ message: "OAuth state secret is not configured." });
	}

	return textEncoder.encode(env.AUTH_OAUTH_STATE_SECRET);
};

const buildFrontendUrl = (c: Context, pathname: string, error?: string) => {
	const env = getEnv(c);
	const url = new URL(pathname, env.APP_FRONTEND_URL);

	if (error) {
		url.searchParams.set("error", error);
	}

	return url.toString();
};

export const buildOAuthFailureRedirect = (c: Context, message: string, _returnTo?: string) => {
	return buildFrontendUrl(c, "/login", message);
};

export const buildOAuthSuccessRedirect = (c: Context, returnTo?: string) => {
	return buildFrontendUrl(c, normalizeReturnTo(returnTo) ?? "/");
};

export const getOAuthProvider = (value: string): OAuthProvider | null => {
	if (value === "google" || value === "apple") {
		return value;
	}

	return null;
};

export const getFirebaseProviderId = (provider: OAuthProvider) => {
	return provider === "google" ? "google.com" : "apple.com";
};

export const getOAuthCallbackUrl = (c: Context, provider: OAuthProvider) => {
	const url = new URL(c.req.url);
	url.pathname = `/api/auth/oauth/${provider}/callback`;
	url.search = "";
	return url.toString();
};

const clearOAuthState = (c: Context, provider: OAuthProvider) => {
	deleteCookie(c, getOAuthStateCookieName(provider), {
		domain: getEnv(c).AUTH_COOKIE_DOMAIN || undefined,
		path: "/api/auth/oauth",
	});
};

export const createOAuthAuthorizationUrl = async (
	c: Context,
	provider: OAuthProvider,
): Promise<OAuthConfigError | string> => {
	const env = getEnv(c);
	const state = crypto.randomUUID();
	const returnTo = normalizeReturnTo(c.req.query("returnTo"));
	const payload: OAuthStatePayload = {
		provider,
		state,
		...(returnTo ? { returnTo } : {}),
	};

	const secret = getOAuthStateSecret(c);
	if (secret instanceof Error) return secret;

	const cookie = await new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(`${OAUTH_STATE_COOKIE_MAX_AGE_SECONDS}s`)
		.sign(secret)
		.catch(
			(e) => new OAuthConfigError({ message: "Failed to create OAuth state token.", cause: e }),
		);
	if (cookie instanceof Error) return cookie;

	setCookie(c, getOAuthStateCookieName(provider), cookie, getOAuthCookieOptions(c));

	if (provider === "google") {
		if (!env.AUTH_GOOGLE_CLIENT_ID || !env.AUTH_GOOGLE_CLIENT_SECRET) {
			return new OAuthConfigError({ message: "Google OAuth is not configured." });
		}

		const url = new URL(GOOGLE_AUTHORIZE_ENDPOINT);
		url.searchParams.set("client_id", env.AUTH_GOOGLE_CLIENT_ID);
		url.searchParams.set("redirect_uri", getOAuthCallbackUrl(c, provider));
		url.searchParams.set("response_type", "code");
		url.searchParams.set("scope", GOOGLE_SCOPE);
		url.searchParams.set("state", state);
		url.searchParams.set("include_granted_scopes", "true");
		url.searchParams.set("prompt", "select_account");
		return url.toString();
	}

	if (
		!env.AUTH_APPLE_CLIENT_ID ||
		!env.AUTH_APPLE_TEAM_ID ||
		!env.AUTH_APPLE_KEY_ID ||
		!env.AUTH_APPLE_PRIVATE_KEY
	) {
		return new OAuthConfigError({ message: "Apple OAuth is not configured." });
	}

	const url = new URL(APPLE_AUTHORIZE_ENDPOINT);
	url.searchParams.set("client_id", env.AUTH_APPLE_CLIENT_ID);
	url.searchParams.set("redirect_uri", getOAuthCallbackUrl(c, provider));
	url.searchParams.set("response_type", "code");
	url.searchParams.set("response_mode", "form_post");
	url.searchParams.set("scope", APPLE_SCOPE);
	url.searchParams.set("state", state);
	return url.toString();
};

export const getOAuthCallbackParams = async (c: Context) => {
	if (c.req.method === "POST") {
		const body = await c.req.parseBody();
		const code = body.code;
		const error = body.error;
		const state = body.state;

		return {
			code: typeof code === "string" ? code : null,
			error: typeof error === "string" ? error : null,
			state: typeof state === "string" ? state : null,
		};
	}

	return {
		code: c.req.query("code") ?? null,
		error: c.req.query("error") ?? null,
		state: c.req.query("state") ?? null,
	};
};

export const consumeOAuthState = async (
	c: Context,
	provider: OAuthProvider,
	returnedState: string | null,
): Promise<OAuthStateError | OAuthConfigError | { returnTo?: string }> => {
	clearOAuthState(c, provider);

	const rawCookie = getCookie(c, getOAuthStateCookieName(provider));

	if (!rawCookie || !isNonEmptyString(returnedState)) {
		return new OAuthStateError({ message: "Missing OAuth state." });
	}

	const secret = getOAuthStateSecret(c);
	if (secret instanceof Error) return secret;

	const verified = await jwtVerify(rawCookie, secret, {
		algorithms: ["HS256"],
	}).catch((e) => new OAuthStateError({ message: "OAuth state verification failed.", cause: e }));
	if (verified instanceof Error) return verified;

	const payload = verified.payload;
	const cookieProvider = payload.provider;
	const cookieState = payload.state;

	if (cookieProvider !== provider || cookieState !== returnedState) {
		return new OAuthStateError({ message: "OAuth state mismatch." });
	}

	return {
		returnTo: typeof payload.returnTo === "string" ? payload.returnTo : undefined,
	};
};

const exchangeGoogleAuthorizationCode = async (
	c: Context,
	code: string,
): Promise<OAuthConfigError | OAuthExchangeError | string> => {
	const env = getEnv(c);

	if (!env.AUTH_GOOGLE_CLIENT_ID || !env.AUTH_GOOGLE_CLIENT_SECRET) {
		return new OAuthConfigError({ message: "Google OAuth is not configured." });
	}

	const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			client_id: env.AUTH_GOOGLE_CLIENT_ID,
			client_secret: env.AUTH_GOOGLE_CLIENT_SECRET,
			code,
			grant_type: "authorization_code",
			redirect_uri: getOAuthCallbackUrl(c, "google"),
		}),
	}).catch(
		(e) => new OAuthExchangeError({ message: "Google OAuth code exchange failed.", cause: e }),
	);
	if (response instanceof Error) return response;

	const payload = (await (response.json() as Promise<unknown>).catch(() => null)) as unknown;

	if (!response.ok || !isGoogleTokenResponse(payload) || !isNonEmptyString(payload.id_token)) {
		const description =
			isGoogleTokenResponse(payload) && isNonEmptyString(payload.error_description)
				? payload.error_description
				: "Google OAuth code exchange failed.";
		return new OAuthExchangeError({ message: description });
	}

	return payload.id_token;
};

const createAppleClientSecret = async (c: Context): Promise<OAuthConfigError | string> => {
	const env = getEnv(c);

	if (
		!env.AUTH_APPLE_CLIENT_ID ||
		!env.AUTH_APPLE_TEAM_ID ||
		!env.AUTH_APPLE_KEY_ID ||
		!env.AUTH_APPLE_PRIVATE_KEY
	) {
		return new OAuthConfigError({ message: "Apple OAuth is not configured." });
	}

	const signingKey = await importPKCS8(env.AUTH_APPLE_PRIVATE_KEY, "ES256").catch(
		(e) => new OAuthConfigError({ message: "Failed to load Apple signing key.", cause: e }),
	);
	if (signingKey instanceof Error) return signingKey;

	const now = Math.floor(Date.now() / 1000);

	const clientSecret = await new SignJWT({})
		.setProtectedHeader({ alg: "ES256", kid: env.AUTH_APPLE_KEY_ID })
		.setIssuer(env.AUTH_APPLE_TEAM_ID)
		.setSubject(env.AUTH_APPLE_CLIENT_ID)
		.setAudience(APPLE_AUDIENCE)
		.setIssuedAt(now)
		.setExpirationTime(now + 300)
		.sign(signingKey)
		.catch(
			(e) => new OAuthConfigError({ message: "Failed to create Apple client secret.", cause: e }),
		);

	return clientSecret;
};

const exchangeAppleAuthorizationCode = async (
	c: Context,
	code: string,
): Promise<OAuthConfigError | OAuthExchangeError | string> => {
	const env = getEnv(c);

	if (!env.AUTH_APPLE_CLIENT_ID) {
		return new OAuthConfigError({ message: "Apple OAuth is not configured." });
	}

	const clientSecret = await createAppleClientSecret(c);
	if (clientSecret instanceof Error) return clientSecret;

	const response = await fetch(APPLE_TOKEN_ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			client_id: env.AUTH_APPLE_CLIENT_ID,
			client_secret: clientSecret,
			code,
			grant_type: "authorization_code",
			redirect_uri: getOAuthCallbackUrl(c, "apple"),
		}),
	}).catch(
		(e) => new OAuthExchangeError({ message: "Apple OAuth code exchange failed.", cause: e }),
	);
	if (response instanceof Error) return response;

	const payload = (await (response.json() as Promise<unknown>).catch(() => null)) as unknown;

	if (!response.ok || !isAppleTokenResponse(payload) || !isNonEmptyString(payload.id_token)) {
		const description =
			isAppleTokenResponse(payload) && isNonEmptyString(payload.error_description)
				? payload.error_description
				: "Apple OAuth code exchange failed.";
		return new OAuthExchangeError({ message: description });
	}

	return payload.id_token;
};

export const exchangeProviderAuthorizationCode = async (
	c: Context,
	provider: OAuthProvider,
	code: string,
): Promise<OAuthConfigError | OAuthExchangeError | string> => {
	if (!isNonEmptyString(code)) {
		return new OAuthExchangeError({ message: "Missing OAuth authorization code." });
	}

	return provider === "google"
		? exchangeGoogleAuthorizationCode(c, code)
		: exchangeAppleAuthorizationCode(c, code);
};

export const getOAuthProviderErrorMessage = (provider: OAuthProvider, error: string) => {
	if (provider === "apple" && error === "user_cancelled_authorize") {
		return "Apple sign-in was cancelled.";
	}

	if (error === "access_denied") {
		return "Authentication was cancelled.";
	}

	return `${provider === "google" ? "Google" : "Apple"} authentication failed.`;
};
