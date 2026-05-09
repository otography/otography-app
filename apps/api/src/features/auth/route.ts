import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { AuthRestError } from "@repo/errors";
import { AuthError } from "@repo/errors/server";
import { signInWithPassword, signUpWithPassword } from "../../shared/firebase/firebase-rest";
import { createSessionCookie, revokeRefreshTokens } from "../../shared/firebase/firebase-admin";
import { csrfProtection, getAuthSession, rateLimitByIp } from "../../shared/middleware";
import { setSessionCookie, clearSessionCookie } from "../../shared/auth/session-cookie";
import { setRefreshTokenCookie, clearRefreshTokenCookie } from "../../shared/auth/refresh-token";
import { errorLogFields, maskIdentifier } from "../../shared/logging/redaction";
import { problemResponse, respondWithError } from "../../shared/errors/error-response";
import type { Bindings } from "../../shared/types/bindings";
import { createUserRecord } from "../user/usecase";
import { googleOAuthRedirect, googleOAuthCallback } from "./lib/google";

const credentialsBodySchema = type({
  email: type.pipe(type("string.trim"), type("string.lower"), type("string.email")),
  password: "string >= 6",
});

const credentialsValidator = arktypeValidator("json", credentialsBodySchema, (result, c) => {
  if (!result.success) {
    return problemResponse(
      c,
      400,
      "bad-request",
      "Bad Request",
      "Please provide a valid email address and a password with at least 6 characters.",
    );
  }
});

const handleAuthError = (error: AuthError | AuthRestError, c: Context<{ Bindings: Bindings }>) => {
  if (error.statusCode >= 500) {
    console.error("Auth request failed.", errorLogFields(error));
  }

  if ("clearCookie" in error && error.clearCookie) {
    clearSessionCookie(c);
    clearRefreshTokenCookie(c);
  }

  return respondWithError(error, c);
};

const auth = new Hono<{ Bindings: Bindings }>()
  .post(
    "/api/auth/sign-in",
    csrfProtection(),
    rateLimitByIp("AUTH_SIGNIN_RATE_LIMITER"),
    credentialsValidator,
    async (c) => {
      const { email, password } = c.req.valid("json");
      console.info("Email sign-in started.", { emailDomain: email.split("@")[1] ?? "[unknown]" });

      const result = await signInWithPassword(c.env.FIREBASE_API_KEY, email, password);
      if (result instanceof Error) {
        console.warn("Email sign-in failed before session creation.", {
          statusCode: result.statusCode,
          message: result.message,
        });
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
      console.info("Email sign-in authenticated with Firebase.", {
        firebaseId: maskIdentifier(result.localId),
      });

      const sessionCookie = await createSessionCookie(result.idToken);
      if (sessionCookie instanceof Error) return handleAuthError(sessionCookie, c);
      console.info("Email sign-in session cookie created.", {
        firebaseId: maskIdentifier(result.localId),
      });

      const userRecord = await createUserRecord({ firebaseId: result.localId });
      if (userRecord instanceof Error) return handleAuthError(userRecord, c);
      console.info("Email sign-in user record ensured.", {
        firebaseId: maskIdentifier(result.localId),
      });

      setSessionCookie(c, sessionCookie);
      const refreshCookie = await setRefreshTokenCookie(c, result.refreshToken);
      if (refreshCookie instanceof Error) return handleAuthError(refreshCookie, c);
      console.info("Email sign-in completed.", { firebaseId: maskIdentifier(result.localId) });
      return c.json({ message: "Signed in successfully." }, 200);
    },
  )
  .post(
    "/api/auth/sign-up",
    csrfProtection(),
    rateLimitByIp("AUTH_SIGNUP_RATE_LIMITER"),
    credentialsValidator,
    async (c) => {
      const { email, password } = c.req.valid("json");
      console.info("Email sign-up started.", { emailDomain: email.split("@")[1] ?? "[unknown]" });

      const signUpResult = await signUpWithPassword(c.env.FIREBASE_API_KEY, email, password);
      if (signUpResult instanceof Error) {
        console.warn("Email sign-up failed before session creation.", {
          statusCode: signUpResult.statusCode,
          message: signUpResult.message,
        });
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
      console.info("Email sign-up created Firebase account.", {
        firebaseId: maskIdentifier(signUpResult.localId),
      });

      const sessionCookie = await createSessionCookie(signUpResult.idToken);
      if (sessionCookie instanceof Error) return handleAuthError(sessionCookie, c);
      console.info("Email sign-up session cookie created.", {
        firebaseId: maskIdentifier(signUpResult.localId),
      });

      // DB にユーザーレコード作成（firebase_id のみ、username は null）
      const userRecord = await createUserRecord({ firebaseId: signUpResult.localId });
      if (userRecord instanceof Error) return handleAuthError(userRecord, c);
      console.info("Email sign-up user record created.", {
        firebaseId: maskIdentifier(signUpResult.localId),
      });

      setSessionCookie(c, sessionCookie);
      const refreshCookie = await setRefreshTokenCookie(c, signUpResult.refreshToken);
      if (refreshCookie instanceof Error) return handleAuthError(refreshCookie, c);
      console.info("Email sign-up completed.", {
        firebaseId: maskIdentifier(signUpResult.localId),
      });
      return c.json({ message: "Account created successfully." }, 201);
    },
  )
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
  .get("/api/auth/google", rateLimitByIp("AUTH_GOOGLE_RATE_LIMITER"), googleOAuthRedirect)
  .get("/api/auth/google/callback", googleOAuthCallback);

export { auth };
