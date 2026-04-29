import type { Context } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import {
  AccountConflictError,
  FirebaseIdpSigninError,
  GoogleTokenExchangeError,
  OAuthStateError,
} from "@repo/errors";
import {
  generateOAuthState,
  verifyOAuthState,
  OAUTH_NONCE_COOKIE_NAME,
} from "../../../shared/auth/oauth-state";
import { exchangeGoogleCode, signInWithGoogleIdp } from "../../../shared/firebase/firebase-google";
import { createSessionCookie } from "../../../shared/firebase/firebase-admin";
import { setSessionCookie } from "../../../shared/auth/session-cookie";
import { setRefreshTokenCookie } from "../../../shared/auth/refresh-token";
import { createUserRecord } from "../../user/usecase";
import type { Bindings } from "../../../shared/types/bindings";

// Google OAuth 認可エンドポイント
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// Google OAuthスコープ
const GOOGLE_SCOPES = "openid email profile";

/**
 * state JWTの検証エラーから適切なエラーコードを判定する。
 * ラップされた元エラー（cause）の型・nameを確認し、
 * 期限切れと明確に判定できる場合のみ expired_state を返す。
 */
const isExpiredError = (value: unknown): boolean => {
  if (!(value instanceof Error)) return false;
  return (
    value.name === "JWTExpired" || (value as Error & { code?: string }).code === "ERR_JWT_EXPIRED"
  );
};

const getStateErrorCode = (error: OAuthStateError): string => {
  if (isExpiredError(error.cause) || isExpiredError(error)) {
    return "expired_state";
  }
  return "invalid_state";
};

/**
 * 外部サービスのエラーから適切なエラーコードへのマッピング。
 * エラーの型（instanceof）に基づいて一意に決定する。
 */
const getOAuthErrorCode = (error: Error): string => {
  if (error instanceof AccountConflictError) return "account_exists";
  if (error instanceof GoogleTokenExchangeError) return "oauth_failed";
  if (error instanceof FirebaseIdpSigninError) return "firebase_auth_failed";
  return "oauth_failed";
};

/**
 * エラーリダイレクトURLを構築する。
 * OAuth エラー時のリダイレクト先は state 内の from フィールドで決定する。
 * from が未指定の場合は /login にフォールバックする。
 * オープンリダイレクト防止のため、from は相対パスのみ許可する。
 */
const buildErrorRedirect = (env: Bindings, errorCode: string, from?: string): string => {
  const safeFrom = from?.startsWith("/") && !from.startsWith("//") ? from : "/login";
  const url = new URL(safeFrom, env.APP_FRONTEND_URL);
  url.searchParams.set("error", errorCode);
  return url.toString();
};

/** Google OAuth 認可画面へリダイレクト */
export const googleOAuthRedirect = async (c: Context<{ Bindings: Bindings }>) => {
  const redirectParam = c.req.query("redirect");
  const rawFromParam = c.req.query("from");
  // オープンリダイレクト防止: from は相対パスのみ許可
  const fromParam =
    rawFromParam?.startsWith("/") && !rawFromParam.startsWith("//") ? rawFromParam : undefined;

  // OAuth state JWTを生成（CSRF対策 + リダイレクト先保持）
  const stateResult = await generateOAuthState(
    c.env.AUTH_OAUTH_STATE_SECRET,
    redirectParam,
    fromParam,
  );
  if (stateResult instanceof Error) {
    return c.redirect(buildErrorRedirect(c.env, "oauth_failed"), 302);
  }

  // CSRF対策: nonce をcookieにバインド（Login CSRF防止）
  // SameSite=Lax により、Googleからのリダイレクト（GET）ではcookieが送信される
  // secure はリクエストプロトコルから導出（localhost HTTPでも動作するように）
  const isSecure = new URL(c.req.url).protocol === "https:";
  setCookie(c, OAUTH_NONCE_COOKIE_NAME, stateResult.nonce, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "Lax",
    path: "/",
    maxAge: 300, // 5分（state JWTのTTLと同じ）
  });

  // Google OAuth URLを構築（redirect_uriは環境変数から取得）
  const callbackUrl = c.env.GOOGLE_OAUTH_REDIRECT_URI;
  const googleAuthUrl = new URL(GOOGLE_AUTH_URL);
  googleAuthUrl.searchParams.set("client_id", c.env.GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  googleAuthUrl.searchParams.set("scope", GOOGLE_SCOPES);
  googleAuthUrl.searchParams.set("state", stateResult.token);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "consent");

  return c.redirect(googleAuthUrl.toString(), 302);
};

/** Google OAuth コールバック — 認可コードを処理してセッションを作成 */
export const googleOAuthCallback = async (c: Context<{ Bindings: Bindings }>) => {
  const code = c.req.query("code");
  const stateParam = c.req.query("state");
  const googleError = c.req.query("error");

  // Google側でキャンセルや同意失敗があった場合
  // stateがあれば検証してfromを取り出し、エラー時のリダイレクト先に使用する
  if (googleError) {
    let errorPage: string | undefined;
    if (stateParam) {
      const statePayload = await verifyOAuthState(c.env.AUTH_OAUTH_STATE_SECRET, stateParam);
      if (!(statePayload instanceof Error)) {
        errorPage = statePayload.from;
      }
    }
    return c.redirect(buildErrorRedirect(c.env, "oauth_failed", errorPage), 302);
  }

  // state パラメータの検証
  if (!stateParam || !code) {
    return c.redirect(buildErrorRedirect(c.env, "invalid_state"), 302);
  }

  // state JWTの検証（署名・有効期限の確認）
  const statePayload = await verifyOAuthState(c.env.AUTH_OAUTH_STATE_SECRET, stateParam);
  if (statePayload instanceof Error) {
    const errorCode = getStateErrorCode(statePayload);
    return c.redirect(buildErrorRedirect(c.env, errorCode), 302);
  }

  // state内のfromフィールド — OAuth エラー時のリダイレクト先
  const errorPage = statePayload.from;

  // Login CSRF対策: cookieのnonceとstate JWTのnonceを照合
  const cookieNonce = getCookie(c, OAUTH_NONCE_COOKIE_NAME);
  const isSecure = new URL(c.req.url).protocol === "https:";
  if (!cookieNonce || cookieNonce !== statePayload.nonce) {
    // nonce不一致 — cookieを削除してエラーリダイレクト
    deleteCookie(c, OAUTH_NONCE_COOKIE_NAME, {
      path: "/",
      secure: isSecure,
    });
    return c.redirect(buildErrorRedirect(c.env, "invalid_state", errorPage), 302);
  }

  // Google認可コードをトークンと交換（redirect_uriは環境変数から取得）
  const callbackUrl = c.env.GOOGLE_OAUTH_REDIRECT_URI;
  const googleTokens = await exchangeGoogleCode({
    clientId: c.env.GOOGLE_CLIENT_ID,
    clientSecret: c.env.GOOGLE_CLIENT_SECRET,
    code,
    redirectUri: callbackUrl,
  });
  if (googleTokens instanceof Error) {
    return c.redirect(buildErrorRedirect(c.env, getOAuthErrorCode(googleTokens), errorPage), 302);
  }

  // Firebase signInWithIdpでGoogle IDトークンを認証
  const firebaseResult = await signInWithGoogleIdp({
    firebaseApiKey: c.env.FIREBASE_API_KEY,
    googleIdToken: googleTokens.id_token,
    requestUri: c.env.APP_FRONTEND_URL,
  });
  if (firebaseResult instanceof Error) {
    return c.redirect(buildErrorRedirect(c.env, getOAuthErrorCode(firebaseResult), errorPage), 302);
  }

  // セッションCookieを作成
  const sessionCookie = await createSessionCookie(firebaseResult.idToken);
  if (sessionCookie instanceof Error) {
    return c.redirect(buildErrorRedirect(c.env, "session_failed", errorPage), 302);
  }

  // リフレッシュトークンCookieを設定
  const refreshResult = await setRefreshTokenCookie(c, firebaseResult.refreshToken);
  if (refreshResult instanceof Error) {
    return c.redirect(buildErrorRedirect(c.env, "session_failed", errorPage), 302);
  }

  // ユーザーレコード作成（冪等: 既存なら何もしない）
  const userRecord = await createUserRecord({ firebaseId: firebaseResult.localId });
  if (userRecord instanceof Error) {
    return c.redirect(buildErrorRedirect(c.env, "session_failed", errorPage), 302);
  }

  // セッションCookieを設定
  setSessionCookie(c, sessionCookie);

  // 使用済みのnonce cookieを削除
  deleteCookie(c, OAUTH_NONCE_COOKIE_NAME, {
    path: "/",
    secure: isSecure,
  });

  // リダイレクト先はstateに保持されたパスを使用（オープンリダイレクト防止で相対パスのみ許可）
  const redirectPath = statePayload.redirect;
  const safeRedirect =
    redirectPath?.startsWith("/") && !redirectPath.startsWith("//") ? redirectPath : "/account";
  return c.redirect(new URL(safeRedirect, c.env.APP_FRONTEND_URL).toString(), 302);
};
