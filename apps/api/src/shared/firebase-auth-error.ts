import { FirebaseAuthError } from "firebase-admin/auth";

const createInternalAuthError = (message: string, cause?: unknown) => {
	const error = (
		FirebaseAuthError as unknown as {
			fromServerError: (code: string, msg: string) => FirebaseAuthError;
		}
	).fromServerError("INTERNAL_ERROR", message);
	if (cause !== undefined) {
		(error as Error & { cause?: unknown }).cause = cause;
	}
	return error;
};

export const normalizeFirebaseAuthError = (error: unknown, fallbackMessage: string) => {
	return error instanceof FirebaseAuthError
		? error
		: createInternalAuthError(fallbackMessage, error);
};

export const shouldClearSessionCookieForAuthError = (error: FirebaseAuthError) => {
	return (
		error.hasCode("argument-error") ||
		error.hasCode("invalid-id-token") ||
		error.hasCode("session-cookie-expired") ||
		error.hasCode("session-cookie-revoked") ||
		error.hasCode("user-disabled") ||
		error.hasCode("user-not-found")
	);
};

export const getRequireAuthFailure = (error: FirebaseAuthError) => {
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

export const getSessionCookieIssuanceFailure = (error: FirebaseAuthError) => {
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

export const getServerSignOutFailure = (error: FirebaseAuthError) => {
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
