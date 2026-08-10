import { type } from "arktype";
import * as errore from "errore";
import { AccountConflictError, FirebaseIdpSigninError } from "@repo/errors";

// Firebase Identity Toolkit ベースURL
const FIREBASE_IDENTITY_TOOLKIT_BASE_URL = "https://identitytoolkit.googleapis.com/v1";

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

const FIREBASE_IDP_PROBLEM_SLUG = "firebase-idp-signin-failed";
const ACCOUNT_CONFLICT_PROBLEM_SLUG = "account-conflict";

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
