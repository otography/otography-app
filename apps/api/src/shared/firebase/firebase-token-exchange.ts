import { type } from "arktype";
import { AuthRestError } from "@repo/errors";

const FIREBASE_SECURE_TOKEN_BASE_URL = "https://securetoken.googleapis.com/v1";

const firebaseTokenExchangeErrorSchema = type({
  error: {
    "message?": "string",
  },
});

const firebaseTokenExchangeResponseSchema = type({
  expires_in: "string",
  token_type: "string",
  refresh_token: "string",
  id_token: "string",
  user_id: "string",
  project_id: "string",
});

const TOKEN_EXCHANGE_ERROR_STATUS: Readonly<Record<string, 400 | 401 | 403 | 503>> = {
  TOKEN_EXPIRED: 401,
  USER_DISABLED: 403,
  USER_NOT_FOUND: 401,
  INVALID_REFRESH_TOKEN: 401,
  INVALID_GRANT_TYPE: 400,
  MISSING_REFRESH_TOKEN: 400,
  PROJECT_NUMBER_MISMATCH: 401,
} as const;

const TOKEN_EXCHANGE_ERROR_MESSAGE: Record<string, string> = {
  TOKEN_EXPIRED: "Your session has expired. Please sign in again.",
  USER_DISABLED: "This account has been disabled.",
  USER_NOT_FOUND: "User not found. The account may have been deleted.",
  INVALID_REFRESH_TOKEN: "Invalid refresh token. Please sign in again.",
  INVALID_GRANT_TYPE: "Invalid grant type.",
  MISSING_REFRESH_TOKEN: "No refresh token provided.",
  PROJECT_NUMBER_MISMATCH: "Project number mismatch.",
};

export const exchangeRefreshToken = async (firebaseApiKey: string, refreshToken: string) => {
  const url = new URL(`${FIREBASE_SECURE_TOKEN_BASE_URL}/token`);
  url.searchParams.set("key", firebaseApiKey);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  }).catch((e) => createTokenExchangeError(undefined, 503, e));
  if (response instanceof Error) return response;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = firebaseTokenExchangeErrorSchema(payload);
    const code = parsedError instanceof type.errors ? undefined : parsedError.error.message;
    return createTokenExchangeError(code);
  }

  if (!payload) {
    return createTokenExchangeError(undefined, 502);
  }

  const parsedPayload = firebaseTokenExchangeResponseSchema(payload);

  if (parsedPayload instanceof type.errors) {
    return createTokenExchangeError(undefined, 502);
  }

  return parsedPayload;
};

const createTokenExchangeError = (
  code?: string,
  fallbackStatus: 400 | 401 | 403 | 502 | 503 = 401,
  cause?: unknown,
) => {
  // Firebase securetoken API はエラーメッセージに直接コードを含む
  // 例: "TOKEN_EXPIRED", "INVALID_REFRESH_TOKEN ...", etc.
  const errorCode = code?.split(" ")[0];
  return new AuthRestError({
    message: TOKEN_EXCHANGE_ERROR_MESSAGE[errorCode ?? ""] ?? "Token exchange failed.",
    statusCode: TOKEN_EXCHANGE_ERROR_STATUS[errorCode ?? ""] ?? fallbackStatus,
    ...(cause ? { cause } : {}),
  });
};
