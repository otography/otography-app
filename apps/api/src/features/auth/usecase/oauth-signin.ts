import type { Database } from "../../../shared/db";
import { exchangeGoogleCode, signInWithGoogleIdp } from "../../../shared/firebase/firebase-google";
import { issueSessionForFirebaseUser } from "./session-issuance";

type GoogleOAuthSignInParams = {
  firebaseApiKey: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  requestUri: string;
  db: Database;
};

type GoogleOAuthSignInResult = {
  opaqueId: string;
};

// Google OAuthコールバックの純粋なオーケストレーション（HTTPコンテキスト非依存）。
// 認可コード交換 → Firebase IdPサインイン → ユーザーレコード作成 → セッション発行。
// state/nonce検証やCookie設定・リダイレクト構築はHTTP層（lib/google.ts）の責務。
export const signInWithGoogleOAuth = async ({
  firebaseApiKey,
  clientId,
  clientSecret,
  code,
  redirectUri,
  requestUri,
  db,
}: GoogleOAuthSignInParams): Promise<GoogleOAuthSignInResult | Error> => {
  // Google認可コードをトークンと交換
  const googleTokens = await exchangeGoogleCode({ clientId, clientSecret, code, redirectUri });
  if (googleTokens instanceof Error) return googleTokens;

  // Firebase signInWithIdpでGoogle IDトークンを認証
  const firebaseResult = await signInWithGoogleIdp({
    firebaseApiKey,
    googleIdToken: googleTokens.id_token,
    requestUri,
  });
  if (firebaseResult instanceof Error) return firebaseResult;

  // ユーザーレコード作成（冪等: 既存なら何もしない） → セッション発行
  const issued = await issueSessionForFirebaseUser({
    firebaseId: firebaseResult.localId,
    firebaseIdToken: firebaseResult.idToken,
    firebaseRefreshToken: firebaseResult.refreshToken,
    db,
  });
  if (issued instanceof Error) return issued;

  return { opaqueId: issued.opaqueId };
};
