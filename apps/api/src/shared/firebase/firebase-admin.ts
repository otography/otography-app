import { env } from "cloudflare:workers";
import { cert, initializeApp } from "@repo/firebase-auth-rest/app";
import { getAuth } from "@repo/firebase-auth-rest/auth";
import { AuthError } from "@repo/errors/server";
import { SESSION_COOKIE_MAX_AGE_MS } from "../auth/session-cookie";

const firebaseAuth = getAuth(
  initializeApp({
    credential: cert({
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replaceAll("\\n", "\n"),
      projectId: env.FIREBASE_PROJECT_ID,
    }),
    projectId: env.FIREBASE_PROJECT_ID,
  }),
);

const createSessionCookie = (idToken: string) =>
  firebaseAuth
    .createSessionCookie(idToken, { expiresIn: SESSION_COOKIE_MAX_AGE_MS })
    .catch((e) => AuthError.fromFirebase(e, "Session creation failed.", 502));

const verifySessionCookieWithOptions = (
  cookie: string,
  { checkRevoked }: { checkRevoked: boolean },
) =>
  firebaseAuth
    .verifySessionCookie(cookie, checkRevoked)
    .catch((e) => AuthError.fromFirebase(e, "Session verification failed."));

// 通常のセッション検証（オフライン JWT 検証のみ）。Firebase への getUser 往復を避ける。
// 失効・無効化チェックが必要なセンシティブ操作では verifySessionCookieStrict を使うこと。
const verifySessionCookie = (cookie: string) =>
  verifySessionCookieWithOptions(cookie, { checkRevoked: false });

// センシティブ操作（アカウント削除など）用の厳格検証。checkRevoked=true で失効・無効化を確認する。
const verifySessionCookieStrict = (cookie: string) =>
  verifySessionCookieWithOptions(cookie, { checkRevoked: true });

const revokeRefreshTokens = (uid: string) =>
  firebaseAuth
    .revokeRefreshTokens(uid)
    .catch((e) => AuthError.fromFirebase(e, "Failed to sign you out.", 502));

export { createSessionCookie, revokeRefreshTokens, verifySessionCookie, verifySessionCookieStrict };
