import { type } from "arktype";
import * as errore from "errore";
import { GoogleTokenExchangeError } from "@repo/errors";

// Google OAuth トークンエンドポイント
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Google トークン交換レスポンスのスキーマ
const googleTokenResponseSchema = type({
  id_token: "string",
  access_token: "string",
  "token_type?": "string",
  "expires_in?": "number",
  "refresh_token?": "string",
  "scope?": "string",
});

// Google エラーレスポンスのスキーマ
const googleErrorResponseSchema = type({
  "error?": "string",
  "error_description?": "string",
});

const GOOGLE_PROBLEM_SLUG = "google-token-exchange-failed";

/**
 * Google認可コードをトークンと交換する。
 * POST https://oauth2.googleapis.com/token を呼び出し、
 * authorization_code グラントタイプで id_token と access_token を取得する。
 */
export const exchangeGoogleCode = async ({
  clientId,
  clientSecret,
  code,
  redirectUri,
}: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}) => {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  }).catch(
    (e) =>
      new GoogleTokenExchangeError({
        message: "Google token exchange failed.",
        problemSlug: GOOGLE_PROBLEM_SLUG,
        cause: e,
      }),
  );
  if (response instanceof Error) {
    return response;
  }

  const responseText = await response.text().catch(
    (e) =>
      new GoogleTokenExchangeError({
        message: "Google token exchange failed.",
        problemSlug: GOOGLE_PROBLEM_SLUG,
        cause: e,
      }),
  );
  if (responseText instanceof Error) return responseText;

  if (response.ok && responseText.length === 0) {
    return new GoogleTokenExchangeError({
      message: "Empty response from Google token endpoint.",
      problemSlug: GOOGLE_PROBLEM_SLUG,
    });
  }

  const payload = errore.try({
    try: () => JSON.parse(responseText),
    catch: (e) =>
      new GoogleTokenExchangeError({
        message: "Invalid response format from Google token endpoint.",
        problemSlug: GOOGLE_PROBLEM_SLUG,
        cause: e,
      }),
  });

  if (!response.ok) {
    if (payload instanceof Error) {
      return new GoogleTokenExchangeError({
        message: "Google token exchange failed.",
        problemSlug: GOOGLE_PROBLEM_SLUG,
        cause: payload,
      });
    }
    const parsedError = googleErrorResponseSchema(payload);
    const errorDesc =
      parsedError instanceof type.errors
        ? "Google token exchange failed."
        : parsedError.error_description || parsedError.error || "Google token exchange failed.";
    return new GoogleTokenExchangeError({ message: errorDesc, problemSlug: GOOGLE_PROBLEM_SLUG });
  }

  if (payload instanceof Error) {
    return new GoogleTokenExchangeError({
      message: "Invalid response format from Google token endpoint.",
      problemSlug: GOOGLE_PROBLEM_SLUG,
      cause: payload,
    });
  }

  const parsedPayload = googleTokenResponseSchema(payload);
  if (parsedPayload instanceof type.errors) {
    return new GoogleTokenExchangeError({
      message: "Invalid response format from Google token endpoint.",
      problemSlug: GOOGLE_PROBLEM_SLUG,
    });
  }

  return parsedPayload;
};
