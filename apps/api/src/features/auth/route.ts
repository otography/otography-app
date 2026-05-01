import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { AuthRestError } from "@repo/errors";
import { AuthError } from "@repo/errors/server";
import { signInWithPassword, signUpWithPassword } from "../../shared/firebase/firebase-rest";
import { createSessionCookie, revokeRefreshTokens } from "../../shared/firebase/firebase-admin";
import { csrfProtection, getAuthSession } from "../../shared/middleware";
import { setSessionCookie, clearSessionCookie } from "../../shared/auth/session-cookie";
import { setRefreshTokenCookie, clearRefreshTokenCookie } from "../../shared/auth/refresh-token";
import type { Bindings } from "../../shared/types/bindings";
import { createUserRecord } from "../user/usecase";
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

const handleAuthError = (error: AuthError | AuthRestError, c: Context<{ Bindings: Bindings }>) => {
  if ("clearCookie" in error && error.clearCookie) {
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
    const refreshCookie = await setRefreshTokenCookie(c, result.refreshToken);
    if (refreshCookie instanceof Error) return handleAuthError(refreshCookie, c);
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
    const sessionCookie = await createSessionCookie(signUpResult.idToken);
    if (sessionCookie instanceof Error) return handleAuthError(sessionCookie, c);

    // DB にユーザーレコード作成（firebase_id のみ、username は null）
    const userRecord = await createUserRecord({ firebaseId: signUpResult.localId });
    if (userRecord instanceof Error) return handleAuthError(userRecord, c);

    setSessionCookie(c, sessionCookie);
    const refreshCookie = await setRefreshTokenCookie(c, signUpResult.refreshToken);
    if (refreshCookie instanceof Error) return handleAuthError(refreshCookie, c);
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
