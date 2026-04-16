import { Hono } from "hono";
import {
  AccountConflictError,
  FirebaseIdpSigninError,
  GoogleTokenExchangeError,
  OAuthStateError,
} from "@repo/errors";
import { generateOAuthState, verifyOAuthState } from "../../shared/auth/oauth-state";
import { exchangeGoogleCode, signInWithGoogleIdp } from "../../shared/firebase/firebase-google";
import { createSessionCookie } from "../../shared/firebase/firebase-admin";
import { setSessionCookie } from "../../shared/auth/session-cookie";
import { setRefreshTokenCookie } from "../../shared/auth/refresh-token";
import type { Bindings } from "../../shared/types/bindings";

// Google OAuth 認可エンドポイント
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// OAuth コールバックのリダイレクトURI（APIベースURLからの相対パス）
const CALLBACK_PATH = "/api/auth/google/callback";

// Google OAuthスコープ
const GOOGLE_SCOPES = "openid email profile";

/**
 * state JWTの検証エラーから適切なエラーコードを判定する。
 * メッセージに"expired"が含まれる場合は期限切れ、それ以外は不正なstateとする。
 */
const getStateErrorCode = (error: OAuthStateError): string => {
  if (error.message.toLowerCase().includes("expired")) {
    return "expired_state";
  }
  return "invalid_state";
};

/**
 * 外部サービスのエラーから適切なエラーコードへのマッピング。
 * エラーのタグ（_tag）に基づいて一意に決定する。
 */
const getOAuthErrorCode = (error: Error): string => {
  if (error instanceof AccountConflictError) return "account_exists";
  if (error instanceof GoogleTokenExchangeError) return "oauth_failed";
  if (error instanceof FirebaseIdpSigninError) return "firebase_auth_failed";
  return "oauth_failed";
};

/**
 * エラーリダイレクトURLを構築する。
 * フロントエンドのログインページにエラーコードを付与してリダイレクトする。
 */
const buildErrorRedirect = (env: Bindings, errorCode: string): string => {
  return `${env.APP_FRONTEND_URL}/login?error=${errorCode}`;
};

const googleAuth = new Hono<{ Bindings: Bindings }>()
  // Google OAuth 認可画面へリダイレクト
  .get("/api/auth/google", async (c) => {
    const redirectParam = c.req.query("redirect");

    // OAuth state JWTを生成（CSRF対策 + リダイレクト先保持）
    const state = await generateOAuthState(c.env.AUTH_OAUTH_STATE_SECRET, redirectParam);
    if (state instanceof Error) {
      return c.redirect(buildErrorRedirect(c.env, "oauth_failed"), 302);
    }

    // Google OAuth URLを構築
    const callbackUrl = new URL(CALLBACK_PATH, c.req.url).href;
    const googleAuthUrl = new URL(GOOGLE_AUTH_URL);
    googleAuthUrl.searchParams.set("client_id", c.env.GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set("redirect_uri", callbackUrl);
    googleAuthUrl.searchParams.set("scope", GOOGLE_SCOPES);
    googleAuthUrl.searchParams.set("state", state);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("access_type", "offline");
    googleAuthUrl.searchParams.set("prompt", "consent");

    return c.redirect(googleAuthUrl.toString(), 302);
  })

  // Google OAuth コールバック — 認可コードを処理してセッションを作成
  .get("/api/auth/google/callback", async (c) => {
    const code = c.req.query("code");
    const stateParam = c.req.query("state");

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

    // Google認可コードをトークンと交換
    const callbackUrl = new URL(CALLBACK_PATH, c.req.url).href;
    const googleTokens = await exchangeGoogleCode({
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: c.env.GOOGLE_CLIENT_SECRET,
      code,
      redirectUri: callbackUrl,
    });
    if (googleTokens instanceof Error) {
      return c.redirect(buildErrorRedirect(c.env, getOAuthErrorCode(googleTokens)), 302);
    }

    // Firebase signInWithIdpでGoogle IDトークンを認証
    const firebaseResult = await signInWithGoogleIdp({
      firebaseApiKey: c.env.FIREBASE_API_KEY,
      googleIdToken: googleTokens.id_token,
    });
    if (firebaseResult instanceof Error) {
      return c.redirect(buildErrorRedirect(c.env, getOAuthErrorCode(firebaseResult)), 302);
    }

    // セッションCookieを作成
    const sessionCookie = await createSessionCookie(firebaseResult.idToken);
    if (sessionCookie instanceof Error) {
      return c.redirect(buildErrorRedirect(c.env, "session_failed"), 302);
    }

    // リフレッシュトークンCookieを設定
    const refreshResult = await setRefreshTokenCookie(c, firebaseResult.refreshToken);
    if (refreshResult instanceof Error) {
      return c.redirect(buildErrorRedirect(c.env, "session_failed"), 302);
    }

    // セッションCookieを設定
    setSessionCookie(c, sessionCookie);

    // リダイレクト先の決定: 新規ユーザー→/setup-profile、既存ユーザー→state内のredirect or /account
    const redirectTo = firebaseResult.isNewUser
      ? `${c.env.APP_FRONTEND_URL}/setup-profile`
      : `${c.env.APP_FRONTEND_URL}${statePayload.redirect}`;

    return c.redirect(redirectTo, 302);
  });

export { googleAuth };
