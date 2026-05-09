import type { ErrorStatusCode } from "./http-status";
import { FirebaseAuthError } from "@repo/firebase-auth-rest/auth";
import * as errore from "errore";

const TYPE_URI_BASE = "https://api.otography.com/errors";

const AUTH_ERROR_CONFIG: Record<
  string,
  { message?: string; statusCode?: ErrorStatusCode; clearCookie?: boolean; typeUri?: string }
> = {
  "auth/internal-error": {
    message: "Authentication service unavailable.",
    statusCode: 503,
    typeUri: `${TYPE_URI_BASE}/auth-service-unavailable`,
  },
  "auth/invalid-session-cookie-duration": {
    message: "Invalid session.",
    statusCode: 500,
    typeUri: `${TYPE_URI_BASE}/session-invalid`,
  },
  "auth/user-disabled": {
    message: "Account is disabled.",
    statusCode: 403,
    clearCookie: true,
    typeUri: `${TYPE_URI_BASE}/account-disabled`,
  },
  "auth/argument-error": {
    message: "Invalid session.",
    clearCookie: true,
    typeUri: `${TYPE_URI_BASE}/session-invalid`,
  },
  "auth/invalid-id-token": {
    message: "Invalid session.",
    clearCookie: true,
    typeUri: `${TYPE_URI_BASE}/session-invalid`,
  },
  "auth/session-cookie-expired": {
    message: "Session expired.",
    clearCookie: true,
    typeUri: `${TYPE_URI_BASE}/session-expired`,
  },
  "auth/session-cookie-revoked": {
    message: "Session revoked.",
    clearCookie: true,
    typeUri: `${TYPE_URI_BASE}/session-revoked`,
  },
  "auth/user-not-found": {
    message: "Invalid session.",
    clearCookie: true,
    typeUri: `${TYPE_URI_BASE}/session-invalid`,
  },
};

class AuthError extends errore.createTaggedError({
  name: "AuthError",
  message: "$message",
}) {
  readonly code: string;
  statusCode: ErrorStatusCode = 401;
  readonly clearCookie: boolean = false;
  readonly typeUri?: string;

  constructor(args: {
    message: string;
    code: string;
    statusCode?: ErrorStatusCode;
    clearCookie?: boolean;
    typeUri?: string;
    cause?: unknown;
  }) {
    super(args);
    this.code = args.code;
    if (args.statusCode !== undefined) this.statusCode = args.statusCode;
    if (args.clearCookie) this.clearCookie = true;
    this.typeUri = args.typeUri;
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
        typeUri: config?.typeUri,
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
