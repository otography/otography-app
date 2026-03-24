import { FirebaseAuthError } from "firebase-admin/auth";

class AuthError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly cause?: unknown,
	) {
		super(message, { cause });
		this.name = "AuthError";
	}

	hasCode(code: string) {
		return this.code === code;
	}
}

const FIREBASE_ERROR_CODES = new Set([
	"argument-error",
	"internal-error",
	"invalid-id-token",
	"invalid-session-cookie-duration",
	"session-cookie-expired",
	"session-cookie-revoked",
	"user-disabled",
	"user-not-found",
]);

export type AuthErrorLike = AuthError | FirebaseAuthError;

const isFirebaseAuthError = (error: unknown): error is FirebaseAuthError =>
	error instanceof FirebaseAuthError;

const toAuthCode = (error: unknown): string => {
	if (isFirebaseAuthError(error)) {
		return error.code;
	}

	if (error instanceof Error && FIREBASE_ERROR_CODES.has(error.message)) {
		return error.message;
	}

	return "unknown-error";
};

export const normalizeFirebaseAuthError = (
	error: unknown,
	fallbackMessage: string,
): AuthErrorLike => {
	if (isFirebaseAuthError(error)) {
		return error;
	}

	return new AuthError(toAuthCode(error), fallbackMessage, error);
};

export const shouldClearSessionCookieForAuthError = (error: AuthErrorLike) => {
	return (
		error.hasCode("argument-error") ||
		error.hasCode("invalid-id-token") ||
		error.hasCode("session-cookie-expired") ||
		error.hasCode("session-cookie-revoked") ||
		error.hasCode("user-disabled") ||
		error.hasCode("user-not-found")
	);
};

export const getRequireAuthFailure = (error: AuthErrorLike) => {
	if (error.hasCode("internal-error")) {
		return {
			body: {
				code: error.code,
				message: "Authentication service is temporarily unavailable.",
			},
			status: 503 as const,
		};
	}

	if (error.hasCode("user-disabled")) {
		return {
			body: {
				code: error.code,
				message: error.message,
			},
			status: 403 as const,
		};
	}

	return {
		body: {
			code: error.code,
			message: "The current session is invalid or has expired.",
		},
		status: 401 as const,
	};
};

export const getSessionCookieIssuanceFailure = (error: AuthErrorLike) => {
	if (error.hasCode("invalid-session-cookie-duration")) {
		return {
			body: {
				code: error.code,
				message: "Authentication is temporarily misconfigured.",
			},
			status: 500 as const,
		};
	}

	if (error.hasCode("internal-error")) {
		return {
			body: {
				code: error.code,
				message: "Failed to establish the authenticated session. Please try again.",
			},
			status: 503 as const,
		};
	}

	if (error.hasCode("user-disabled")) {
		return {
			body: {
				code: error.code,
				message: error.message,
			},
			status: 403 as const,
		};
	}

	return {
		body: {
			code: error.code,
			message: "Failed to establish the authenticated session.",
		},
		status: 502 as const,
	};
};

export const getServerSignOutFailure = (error: AuthErrorLike) => {
	if (error.hasCode("internal-error")) {
		return {
			body: {
				code: error.code,
				message: "Failed to complete sign out on the authentication server. Please try again.",
			},
			status: 503 as const,
		};
	}

	return {
		body: {
			code: error.code,
			message: "Failed to complete sign out on the authentication server.",
		},
		status: 502 as const,
	};
};
