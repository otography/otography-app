import { type } from "arktype";
import type { Context } from "hono";
import { env } from "hono/adapter";
import { AuthRestError } from "@repo/errors";
import type { ServerEnv } from "../server-env";

const FIREBASE_IDENTITY_TOOLKIT_BASE_URL = "https://identitytoolkit.googleapis.com/v1";

const firebaseErrorResponseSchema = type({
	error: {
		"message?": "string",
	},
});

const firebaseEmailPasswordAuthResponseSchema = type({
	expiresIn: "string",
	idToken: "string",
	localId: "string",
	refreshToken: "string",
	"displayName?": "string",
	"email?": "string",
	"isNewUser?": "boolean",
	"oauthAccessToken?": "string",
	"oauthIdToken?": "string",
	"photoUrl?": "string",
	"providerId?": "string",
	"rawUserInfo?": "string",
	"registered?": "boolean",
});

const FIREBASE_AUTH_ERROR_STATUS: Readonly<Record<string, 400 | 401 | 403 | 409 | 429 | 503>> = {
	EMAIL_EXISTS: 409,
	FEDERATED_USER_ID_ALREADY_LINKED: 409,
	INVALID_EMAIL: 400,
	INVALID_IDP_RESPONSE: 401,
	INVALID_LOGIN_CREDENTIALS: 401,
	INVALID_PASSWORD: 401,
	INVALID_PROVIDER_ID: 400,
	OPERATION_NOT_ALLOWED: 503,
	TOO_MANY_ATTEMPTS_TRY_LATER: 429,
	USER_DISABLED: 403,
	WEAK_PASSWORD: 400,
} as const;

const FIREBASE_AUTH_ERROR_MESSAGE: Record<string, string> = {
	EMAIL_EXISTS: "This email address is already registered.",
	FEDERATED_USER_ID_ALREADY_LINKED: "This provider account is already linked to another user.",
	INVALID_EMAIL: "Please provide a valid email address.",
	INVALID_IDP_RESPONSE: "The third-party authentication response is invalid or expired.",
	INVALID_LOGIN_CREDENTIALS: "Invalid email address or password.",
	INVALID_PASSWORD: "Invalid email address or password.",
	INVALID_PROVIDER_ID: "This authentication provider is not enabled.",
	OPERATION_NOT_ALLOWED: "This authentication provider is not enabled.",
	TOO_MANY_ATTEMPTS_TRY_LATER: "Too many authentication attempts. Please try again later.",
	USER_DISABLED: "This account has been disabled.",
	WEAK_PASSWORD: "Password must be at least 6 characters long.",
};

const createAuthRestError = (
	code?: string,
	fallbackStatus: 400 | 401 | 403 | 409 | 429 | 502 | 503 = 401,
	cause?: unknown,
) => {
	return new AuthRestError({
		message: FIREBASE_AUTH_ERROR_MESSAGE[code ?? ""] ?? "Authentication failed.",
		statusCode: FIREBASE_AUTH_ERROR_STATUS[code ?? ""] ?? fallbackStatus,
		...(cause ? { cause } : {}),
	});
};

const requestFirebaseAuth = async (c: Context, endpoint: string, body: Record<string, unknown>) => {
	const { FIREBASE_API_KEY } = env<ServerEnv>(c);
	const url = new URL(`${FIREBASE_IDENTITY_TOOLKIT_BASE_URL}/${endpoint}`);
	url.searchParams.set("key", FIREBASE_API_KEY);

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	}).catch((e) => {
		throw createAuthRestError(undefined, 503, e);
	});

	const payload = await (response.json() as Promise<unknown>).catch(() => null);

	if (!response.ok) {
		const parsedError = firebaseErrorResponseSchema(payload);
		const code = parsedError instanceof type.errors ? undefined : parsedError.error.message;
		throw createAuthRestError(code);
	}

	if (!payload) {
		throw createAuthRestError(undefined, 502);
	}

	const parsedPayload = firebaseEmailPasswordAuthResponseSchema(payload);

	if (parsedPayload instanceof type.errors) {
		throw createAuthRestError(undefined, 502);
	}

	return parsedPayload;
};

export const signInWithPassword = async (c: Context, email: string, password: string) => {
	return requestFirebaseAuth(c, "accounts:signInWithPassword", {
		email,
		password,
		returnSecureToken: true,
	});
};

export const signUpWithPassword = async (c: Context, email: string, password: string) => {
	return requestFirebaseAuth(c, "accounts:signUp", {
		email,
		password,
		returnSecureToken: true,
	});
};
