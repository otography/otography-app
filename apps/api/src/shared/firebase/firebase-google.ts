import { type } from "arktype";
import * as errore from "errore";
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

// Firebase signInWithIdp アカウント重複チェック用スキーマ
// needConfirmation=trueの場合、idToken/refreshTokenが含まれないことがあるため
// スキーマ検証の前に判定する
const firebaseIdpConflictSchema = type({
  "needConfirmation?": "boolean",
});

// Firebase signInWithIdp レスポンスのスキーマ
const firebaseIdpResponseSchema = type({
  idToken: "string",
  refreshToken: "string",
  localId: "string",
  expiresIn: "string",
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
  console.log("[exchangeGoogleCode] 開始:", { redirectUri, codePrefix: code.slice(0, 8) + "..." });

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
    console.error("[exchangeGoogleCode] fetch失敗:", response.message);
    return response;
  }

  const responseText = await response.text().catch(() => "");

  const payload = errore.try({
    try: () => JSON.parse(responseText),
    catch: () => null,
  });

  if (!response.ok) {
    const parsedError = googleErrorResponseSchema(payload);
    const errorDesc =
      parsedError instanceof type.errors
        ? "Google token exchange failed."
        : parsedError.error_description || parsedError.error || "Google token exchange failed.";
    console.error("[exchangeGoogleCode] HTTPエラー:", response.status, errorDesc, {
      responseText: responseText.slice(0, 500),
    });
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
  requestUri,
}: {
  firebaseApiKey: string;
  googleIdToken: string;
  requestUri: string;
}) => {
  const url = new URL(`${FIREBASE_IDENTITY_TOOLKIT_BASE_URL}/accounts:signInWithIdp`);
  url.searchParams.set("key", firebaseApiKey);

  console.log("[signInWithGoogleIdp] 開始:", {
    requestUri,
    idTokenPrefix: googleIdToken.slice(0, 20) + "...",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postBody: `id_token=${googleIdToken}&providerId=google.com`,
      requestUri,
      returnSecureToken: true,
      returnIdpCredential: true,
    }),
  }).catch(
    (e) => new FirebaseIdpSigninError({ message: "Firebase IdP sign-in failed.", cause: e }),
  );
  if (response instanceof Error) {
    console.error("[signInWithGoogleIdp] fetch失敗:", response.message);
    return response;
  }

  // レスポンス本文を取得して後続のパースとエラー判定に利用
  const responseText = await response.text().catch(() => "");

  const payload = errore.try({
    try: () => JSON.parse(responseText),
    catch: () => null,
  });

  if (!response.ok) {
    const parsedError = firebaseErrorResponseSchema(payload);
    const code = parsedError instanceof type.errors ? undefined : parsedError.error.message;
    console.error("[signInWithGoogleIdp] HTTPエラー:", response.status, code ?? "unknown", {
      responseText: responseText.slice(0, 500),
    });
    return new FirebaseIdpSigninError({
      message: code ?? "Firebase IdP sign-in failed.",
    });
  }

  if (!payload) {
    return new FirebaseIdpSigninError({
      message: "Empty response from Firebase signInWithIdp.",
    });
  }

  console.log("[signInWithGoogleIdp] レスポンス:", JSON.stringify(payload).slice(0, 1000));

  // needConfirmation=trueの場合、同一メールアドレスが別プロバイダーで既に登録済み
  const conflictCheck = firebaseIdpConflictSchema(payload);
  if (!(conflictCheck instanceof type.errors) && conflictCheck.needConfirmation === true) {
    return new AccountConflictError({
      message:
        "An account with this email already exists. Please sign in with your original method.",
    });
  }

  const parsedPayload = firebaseIdpResponseSchema(payload);
  if (parsedPayload instanceof type.errors) {
    console.error("[signInWithGoogleIdp] スキーマ検証失敗:", parsedPayload.summary);
    return new FirebaseIdpSigninError({
      message: "Invalid response format from Firebase signInWithIdp.",
    });
  }

  return parsedPayload;
};
