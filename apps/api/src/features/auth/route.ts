import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { AuthError } from "@repo/errors/server";
import { signInWithPassword, signUpWithPassword } from "../../shared/firebase/firebase-rest";
import {
  createSessionCookie,
  revokeRefreshTokens,
  createCustomToken,
  setCustomUserClaims,
} from "../../shared/firebase/firebase-admin";
import { exchangeCustomToken } from "../../shared/firebase/firebase-token-exchange";
import { csrfProtection, getAuthSession } from "../../shared/middleware";
import { setSessionCookie, clearSessionCookie } from "../../shared/auth/session-cookie";
import { setRefreshTokenCookie, clearRefreshTokenCookie } from "../../shared/auth/refresh-token";
import { createDb } from "../../shared/db";
import { users } from "../../shared/db/schema";
import type { Bindings } from "../../shared/types/bindings";
import { googleOAuthRedirect, googleOAuthCallback } from "./lib/google";

const credentialsBodySchema = type({
  email: type.pipe(type("string.trim"), type("string.lower"), type("string.email")),
  password: "string >= 6",
});

const credentialsValidator = arktypeValidator("json", credentialsBodySchema, (result, c) => {
  if (!result.success) {
    return c.json(
      {
        message: "Please provide a valid email address and a password with at least 6 characters.",
      },
      400,
    );
  }
});

const handleAuthError = (error: AuthError, c: Context<{ Bindings: Bindings }>) => {
  if (error.clearCookie) {
    clearSessionCookie(c);
    clearRefreshTokenCookie(c);
  }
  return c.json({ message: error.message }, error.statusCode);
};

const auth = new Hono<{ Bindings: Bindings }>()
  .post("/api/auth/sign-in", csrfProtection(), credentialsValidator, async (c) => {
    const { email, password } = c.req.valid("json");
    const result = await signInWithPassword(c.env.FIREBASE_API_KEY, email, password);
    if (result instanceof Error) {
      return handleAuthError(
        new AuthError({
          message: result.message,
          code: "sign-in-failed",
          statusCode: result.statusCode,
          cause: result,
        }),
        c,
      );
    }
    const sessionCookie = await createSessionCookie(result.idToken);
    if (sessionCookie instanceof Error) return handleAuthError(sessionCookie, c);
    setSessionCookie(c, sessionCookie);
    await setRefreshTokenCookie(c, result.refreshToken);
    return c.json({ message: "Signed in successfully." }, 200);
  })
  .post("/api/auth/sign-up", csrfProtection(), credentialsValidator, async (c) => {
    const { email, password } = c.req.valid("json");
    const signUpResult = await signUpWithPassword(c.env.FIREBASE_API_KEY, email, password);
    if (signUpResult instanceof Error) {
      return handleAuthError(
        new AuthError({
          message: signUpResult.message,
          code: "sign-up-failed",
          statusCode: signUpResult.statusCode,
          cause: signUpResult,
        }),
        c,
      );
    }

    // 1. DB にユーザーレコード作成 (firebase_id のみ、username は null)
    const db = createDb();
    const insertResult = await db
      .insert(users)
      .values({ firebaseId: signUpResult.localId })
      .returning()
      .catch(
        (e) =>
          new AuthError({
            message: "Failed to create user record.",
            code: "db-error",
            statusCode: 500,
            cause: e,
          }),
      );
    if (insertResult instanceof Error) return handleAuthError(insertResult, c);

    const newUser = insertResult[0];
    if (!newUser) {
      return handleAuthError(
        new AuthError({
          message: "Failed to create user record.",
          code: "db-error",
          statusCode: 500,
        }),
        c,
      );
    }

    // 2. Custom Claims に UUID を設定
    const claimsResult = await setCustomUserClaims(signUpResult.localId, {
      db_uuid: newUser.id,
    });
    if (claimsResult instanceof Error) return handleAuthError(claimsResult, c);

    // 3. Custom Token 作成 → ID Token 交換 (db_uuid を含む新鮮なトークンを取得)
    const customTokenResult = await createCustomToken(signUpResult.localId);
    if (customTokenResult instanceof Error) return handleAuthError(customTokenResult, c);

    const tokenResult = await exchangeCustomToken(c.env.FIREBASE_API_KEY, customTokenResult);
    if (tokenResult instanceof Error) {
      return handleAuthError(
        new AuthError({
          message: tokenResult.message,
          code: "token-exchange-failed",
          statusCode: tokenResult.statusCode,
          cause: tokenResult,
        }),
        c,
      );
    }

    // 4. セッションクッキー作成
    const sessionCookie = await createSessionCookie(tokenResult.idToken);
    if (sessionCookie instanceof Error) return handleAuthError(sessionCookie, c);
    setSessionCookie(c, sessionCookie);

    // 5. リフレッシュトークン (交換で得られたものを使用)
    await setRefreshTokenCookie(c, tokenResult.refreshToken);

    return c.json({ message: "Account created successfully." }, 201);
  })
  .post("/api/auth/sign-out", csrfProtection(), async (c) => {
    const session = getAuthSession(c);
    const userId = session?.sub;

    if (!userId) {
      clearSessionCookie(c);
      clearRefreshTokenCookie(c);
      return c.body(null, 204);
    }

    const revokeResult = await revokeRefreshTokens(userId);
    if (revokeResult instanceof Error) {
      if (revokeResult.clearCookie) {
        clearSessionCookie(c);
        clearRefreshTokenCookie(c);
        return c.body(null, 204);
      }
      return handleAuthError(revokeResult, c);
    }

    clearSessionCookie(c);
    clearRefreshTokenCookie(c);
    return c.body(null, 204);
  })
  .get("/api/auth/google", googleOAuthRedirect)
  .get("/api/auth/google/callback", googleOAuthCallback);

export { auth };
