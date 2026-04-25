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

const verifySessionCookie = (cookie: string) =>
  firebaseAuth
    .verifySessionCookie(cookie, true)
    .catch((e) => AuthError.fromFirebase(e, "Session verification failed."));

const revokeRefreshTokens = (uid: string) =>
  firebaseAuth
    .revokeRefreshTokens(uid)
    .catch((e) => AuthError.fromFirebase(e, "Failed to sign you out.", 502));

// Custom Token 作成（ローカル JWT 署名、REST API 不要）
const createCustomToken = (uid: string, developerClaims?: object) =>
  firebaseAuth
    .createCustomToken(uid, developerClaims)
    .catch((e) => AuthError.fromFirebase(e, "Failed to create custom token.", 502));

// Custom Claims 設定
const setCustomUserClaims = (uid: string, customUserClaims: object | null) =>
  firebaseAuth
    .setCustomUserClaims(uid, customUserClaims)
    .catch((e) => AuthError.fromFirebase(e, "Failed to set custom claims.", 502));

export {
  createSessionCookie,
  verifySessionCookie,
  revokeRefreshTokens,
  createCustomToken,
  setCustomUserClaims,
};
