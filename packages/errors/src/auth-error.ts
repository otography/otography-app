import type { ContentfulStatusCode } from "hono/utils/http-status";
import { FirebaseAuthError } from "firebase-admin/auth";
import * as errore from "errore";

const AUTH_ERROR_CONFIG: Record<
	string,
	{ statusCode?: ContentfulStatusCode; clearCookie?: boolean }
> = {
	"internal-error": { statusCode: 503 },
	"invalid-session-cookie-duration": { statusCode: 500 },
	"user-disabled": { statusCode: 403, clearCookie: true },
	"argument-error": { clearCookie: true },
	"invalid-id-token": { clearCookie: true },
	"session-cookie-expired": { clearCookie: true },
	"session-cookie-revoked": { clearCookie: true },
	"user-not-found": { clearCookie: true },
};

class AuthError extends errore.createTaggedError({
	name: "AuthError",
	message: "$message",
}) {
	readonly code: string;
	statusCode: ContentfulStatusCode = 401;
	readonly clearCookie: boolean = false;

	constructor(args: {
		message: string;
		code: string;
		statusCode?: ContentfulStatusCode;
		clearCookie?: boolean;
		cause?: unknown;
	}) {
		super(args);
		this.code = args.code;
		if (args.statusCode !== undefined) this.statusCode = args.statusCode;
		if (args.clearCookie) this.clearCookie = true;
	}

	static fromFirebase(
		error: unknown,
		fallbackMessage: string,
		fallbackStatus: ContentfulStatusCode = 401,
	): AuthError {
		if (error instanceof FirebaseAuthError) {
			const config = AUTH_ERROR_CONFIG[error.code];
			return new AuthError({
				message: error.message,
				code: error.code,
				statusCode: config?.statusCode ?? fallbackStatus,
				clearCookie: config?.clearCookie,
				cause: error,
			});
		}

		return new AuthError({
			message: fallbackMessage,
			code: "unknown-error",
			statusCode: fallbackStatus,
			cause: error,
		});
	}
}

export { AuthError };
