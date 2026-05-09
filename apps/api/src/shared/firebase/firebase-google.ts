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

const GOOGLE_PROBLEM_SLUG = "google-token-exchange-failed";
const FIREBASE_IDP_PROBLEM_SLUG = "firebase-idp-signin-failed";
const ACCOUNT_CONFLICT_PROBLEM_SLUG = "account-conflict";

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
    (e) =>
      new FirebaseIdpSigninError({
        message: "Firebase IdP sign-in failed.",
        problemSlug: FIREBASE_IDP_PROBLEM_SLUG,
        cause: e,
      }),
  );
  if (response instanceof Error) {
    return response;
  }

  // レスポンス本文を取得して後続のパースとエラー判定に利用
  const responseText = await response.text().catch(
    (e) =>
      new FirebaseIdpSigninError({
        message: "Firebase IdP sign-in failed.",
        problemSlug: FIREBASE_IDP_PROBLEM_SLUG,
        cause: e,
      }),
  );
  if (responseText instanceof Error) return responseText;

  if (response.ok && responseText.length === 0) {
    return new FirebaseIdpSigninError({
      message: "Empty response from Firebase signInWithIdp.",
      problemSlug: FIREBASE_IDP_PROBLEM_SLUG,
    });
  }

  const payload = errore.try({
    try: () => JSON.parse(responseText),
    catch: (e) =>
      new FirebaseIdpSigninError({
        message: "Invalid response format from Firebase signInWithIdp.",
        problemSlug: FIREBASE_IDP_PROBLEM_SLUG,
        cause: e,
      }),
  });

  if (!response.ok) {
    if (payload instanceof Error) {
      return new FirebaseIdpSigninError({
        message: "Firebase IdP sign-in failed.",
        problemSlug: FIREBASE_IDP_PROBLEM_SLUG,
        cause: payload,
      });
    }
    const parsedError = firebaseErrorResponseSchema(payload);
    const code = parsedError instanceof type.errors ? undefined : parsedError.error.message;
    return new FirebaseIdpSigninError({
      message: code ?? "Firebase IdP sign-in failed.",
      problemSlug: FIREBASE_IDP_PROBLEM_SLUG,
    });
  }

  if (payload instanceof Error) {
    return new FirebaseIdpSigninError({
      message: "Invalid response format from Firebase signInWithIdp.",
      problemSlug: FIREBASE_IDP_PROBLEM_SLUG,
      cause: payload,
    });
  }

  // needConfirmation=trueの場合、同一メールアドレスが別プロバイダーで既に登録済み
  const conflictCheck = firebaseIdpConflictSchema(payload);
  if (!(conflictCheck instanceof type.errors) && conflictCheck.needConfirmation === true) {
    return new AccountConflictError({
      message:
        "An account with this email already exists. Please sign in with your original method.",
      problemSlug: ACCOUNT_CONFLICT_PROBLEM_SLUG,
    });
  }

  const parsedPayload = firebaseIdpResponseSchema(payload);
  if (parsedPayload instanceof type.errors) {
    return new FirebaseIdpSigninError({
      message: "Invalid response format from Firebase signInWithIdp.",
      problemSlug: FIREBASE_IDP_PROBLEM_SLUG,
    });
  }

  return parsedPayload;
};
