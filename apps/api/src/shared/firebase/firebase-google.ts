import { type } from "arktype";
import {
  AccountConflictError,
  FirebaseIdpSigninError,
  GoogleTokenExchangeError,
} from "@repo/errors";

// Google OAuth トークンエンドポイント
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Firebase Identity Toolkit ベースURL
const FIREBASE_IDENTITY_TOOLKIT_BASE_URL = "https://identitytoolkit.googleapis.com/v1";

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

// Firebase signInWithIdp レスポンスのスキーマ
const firebaseIdpResponseSchema = type({
  idToken: "string",
  refreshToken: "string",
  localId: "string",
  "isNewUser?": "boolean",
  "email?": "string",
  "displayName?": "string",
  "photoUrl?": "string",
  "needConfirmation?": "boolean",
});

// Firebase エラーレスポンスのスキーマ
const firebaseErrorResponseSchema = type({
  error: {
    "message?": "string",
  },
});

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
    (e) => new GoogleTokenExchangeError({ message: "Google token exchange failed.", cause: e }),
  );
  if (response instanceof Error) {
    return response;
  }

  const responseText = await response.text().catch(() => "");

  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const parsedError = googleErrorResponseSchema(payload);
    const errorDesc =
      parsedError instanceof type.errors
        ? "Google token exchange failed."
        : `${parsedError.error}: ${parsedError.error_description}`;
    return new GoogleTokenExchangeError({ message: errorDesc });
  }

  if (!payload) {
    return new GoogleTokenExchangeError({ message: "Empty response from Google token endpoint." });
  }

  const parsedPayload = googleTokenResponseSchema(payload);
  if (parsedPayload instanceof type.errors) {
    return new GoogleTokenExchangeError({
      message: "Invalid response format from Google token endpoint.",
    });
  }

  return parsedPayload;
};

/**
 * Firebase signInWithIdp を呼び出し、Google IDトークンで認証する。
 * 成功時はFirebaseのIDトークンとリフレッシュトークン等を返す。
 * needConfirmation=true（メールアドレスの重複）の場合はAccountConflictErrorを返す。
 */
export const signInWithGoogleIdp = async ({
  firebaseApiKey,
  googleIdToken,
}: {
  firebaseApiKey: string;
  googleIdToken: string;
}) => {
  const url = new URL(`${FIREBASE_IDENTITY_TOOLKIT_BASE_URL}/accounts:signInWithIdp`);
  url.searchParams.set("key", firebaseApiKey);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postBody: `id_token=${googleIdToken}&providerId=google.com`,
      requestUri: "http://localhost:3000",
      returnSecureToken: true,
      returnIdpCredential: true,
    }),
  }).catch(
    (e) => new FirebaseIdpSigninError({ message: "Firebase IdP sign-in failed.", cause: e }),
  );
  if (response instanceof Error) {
    return response;
  }

  // レスポンスの生ステータスとbodyのログ
  const responseText = await response.text().catch(() => "");

  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const parsedError = firebaseErrorResponseSchema(payload);
    const code = parsedError instanceof type.errors ? undefined : parsedError.error.message;
    return new FirebaseIdpSigninError({
      message: code ?? "Firebase IdP sign-in failed.",
    });
  }

  if (!payload) {
    return new FirebaseIdpSigninError({
      message: "Empty response from Firebase signInWithIdp.",
    });
  }

  const parsedPayload = firebaseIdpResponseSchema(payload);
  if (parsedPayload instanceof type.errors) {
    return new FirebaseIdpSigninError({
      message: "Invalid response format from Firebase signInWithIdp.",
    });
  }

  // needConfirmation=trueの場合、同一メールアドレスが別プロバイダーで既に登録済み
  if (parsedPayload.needConfirmation) {
    return new AccountConflictError({
      message:
        "An account with this email already exists. Please sign in with your original method.",
    });
  }

  return parsedPayload;
};
