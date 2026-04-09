import type { ErrorStatusCode } from "./http-status";
import { FirebaseAuthError } from "@repo/firebase-auth-rest/auth";
import * as errore from "errore";

const AUTH_ERROR_CONFIG: Record<
  string,
  { message?: string; statusCode?: ErrorStatusCode; clearCookie?: boolean }
> = {
  "auth/internal-error": { message: "Authentication service unavailable.", statusCode: 503 },
  "auth/invalid-session-cookie-duration": { message: "Invalid session.", statusCode: 500 },
  "auth/user-disabled": { message: "Account is disabled.", statusCode: 403, clearCookie: true },
  "auth/argument-error": { message: "Invalid session.", clearCookie: true },
  "auth/invalid-id-token": { message: "Invalid session.", clearCookie: true },
  "auth/session-cookie-expired": { message: "Session expired.", clearCookie: true },
  "auth/session-cookie-revoked": { message: "Session revoked.", clearCookie: true },
  "auth/user-not-found": { message: "Invalid session.", clearCookie: true },
};

class AuthError extends errore.createTaggedError({
  name: "AuthError",
  message: "$message",
}) {
  readonly code: string;
  statusCode: ErrorStatusCode = 401;
  readonly clearCookie: boolean = false;

  constructor(args: {
    message: string;
    code: string;
    statusCode?: ErrorStatusCode;
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
    fallbackStatus: ErrorStatusCode = 401,
  ): AuthError {
    if (error instanceof FirebaseAuthError) {
      const config = AUTH_ERROR_CONFIG[error.code];
      return new AuthError({
        message: config?.message ?? fallbackMessage,
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
