import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { AuthRestError } from "@repo/errors";
import { AuthError } from "@repo/errors/server";
import { signInWithPassword, signUpWithPassword } from "../../shared/firebase/firebase-rest";
import { csrfProtection, rateLimitByIp } from "../../shared/middleware";
import { clearOpaqueSessionCookie, setOpaqueSessionCookie } from "../../shared/auth/opaque-cookie";
import { getEncryptCtx } from "../../shared/auth/key-ring-loader";
import { issueSession } from "../../shared/auth/session-service";
import { revokeSession } from "../../shared/auth/session-repository";
import { errorLogFields, maskIdentifier } from "../../shared/logging/redaction";
import { badRequestResponse, respondWithError } from "../../shared/errors/error-response";
import { domainAuthError } from "../../shared/errors/domain-error";
import type { Env } from "../../shared/types/env";
import { createUserRecord } from "../user/usecase";
import { googleOAuthRedirect, googleOAuthCallback } from "./lib/google";

const credentialsBodySchema = type({
  email: type.pipe(type("string.trim"), type("string.lower"), type("string.email")),
  password: "string >= 6",
});

const credentialsValidator = arktypeValidator("json", credentialsBodySchema, (result, c) => {
  if (!result.success) {
    return badRequestResponse(
      c,
      "Please provide a valid email address and a password with at least 6 characters.",
    );
  }
});

const handleAuthError = (error: AuthError | AuthRestError, c: Context<Env>) => {
  if (error.statusCode >= 500) {
    console.error("Auth request failed.", errorLogFields(error));
  }

  if ("clearCookie" in error && error.clearCookie) {
    clearOpaqueSessionCookie(c);
  }

  return respondWithError(error, c);
};

// 暗号化コンテキストを取得（失敗時はエラーレスポンス）
const getCtxOrError = async () => {
  const ctx = await getEncryptCtx();
  if (ctx instanceof Error) {
    console.error("暗号化コンテキストの初期化に失敗しました。", { message: ctx.message });
    return new AuthError({
      message: "Session encryption not configured.",
      code: "encryption-config-error",
      statusCode: 500,
      cause: ctx,
    });
  }
  return ctx;
};

const auth = new Hono<Env>()
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

      // DBにユーザーレコード作成（先に作成、失敗時はセッションを発行しない）
      const userRecord = await createUserRecord({ firebaseId: result.localId }, c.var.db());
      if (userRecord instanceof Error) return handleAuthError(userRecord, c);
      console.info("Email sign-in user record ensured.", {
        firebaseId: maskIdentifier(result.localId),
      });

      // 暗号化コンテキスト取得
      const ctx = await getCtxOrError();
      if (ctx instanceof Error) return handleAuthError(ctx, c);

      // サーバーセッションを発行
      const issued = await issueSession({
        firebaseIdToken: result.idToken,
        firebaseRefreshToken: result.refreshToken,
        userId: userRecord.id,
        db: c.var.db(),
        ctx,
      });
      if (issued instanceof Error) {
        return handleAuthError(
          new AuthError({
            message: issued.message,
            code: "session-issuance-failed",
            statusCode: 500,
            cause: issued,
          }),
          c,
        );
      }

      // オペークCookieのみを設定（Firebaseクレデンシャルはブラウザに置かない）
      setOpaqueSessionCookie(c, issued.opaqueId);
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
        const error =
          signUpResult.statusCode === 409
            ? domainAuthError({
                slug: "email-already-registered",
                message: signUpResult.message,
                code: "sign-up-failed",
                cause: signUpResult,
              })
            : new AuthError({
                message: signUpResult.message,
                code: "sign-up-failed",
                statusCode: signUpResult.statusCode,
                cause: signUpResult,
              });
        return handleAuthError(error, c);
      }
      console.info("Email sign-up created Firebase account.", {
        firebaseId: maskIdentifier(signUpResult.localId),
      });

      // DBにユーザーレコード作成
      const userRecord = await createUserRecord({ firebaseId: signUpResult.localId }, c.var.db());
      if (userRecord instanceof Error) return handleAuthError(userRecord, c);
      console.info("Email sign-up user record created.", {
        firebaseId: maskIdentifier(signUpResult.localId),
      });

      // 暗号化コンテキスト取得
      const ctx = await getCtxOrError();
      if (ctx instanceof Error) return handleAuthError(ctx, c);

      // サーバーセッションを発行
      const issued = await issueSession({
        firebaseIdToken: signUpResult.idToken,
        firebaseRefreshToken: signUpResult.refreshToken,
        userId: userRecord.id,
        db: c.var.db(),
        ctx,
      });
      if (issued instanceof Error) {
        return handleAuthError(
          new AuthError({
            message: issued.message,
            code: "session-issuance-failed",
            statusCode: 500,
            cause: issued,
          }),
          c,
        );
      }

      setOpaqueSessionCookie(c, issued.opaqueId);
      console.info("Email sign-up completed.", {
        firebaseId: maskIdentifier(signUpResult.localId),
      });
      return c.json({ message: "Account created successfully." }, 201);
    },
  )
  // サインアウト: 現在のデバイスのサーバーセッションのみを無効化する（#2）。
  // Firebase のグローバルな revokeRefreshTokens は呼ばない（アカウント削除/sign-out-all のみ）。
  .post("/api/auth/sign-out", csrfProtection(), async (c) => {
    const sessionCtx = c.get("sessionCtx");

    // Cookieがない、またはセッションが未解決 → Cookieクリアのみ
    if (!sessionCtx) {
      clearOpaqueSessionCookie(c);
      return c.body(null, 204);
    }

    // sessionCtx からセッションIDを取得して無効化（再ハッシュ/再照会なし #3）
    const revokeResult = await revokeSession(c.var.db(), sessionCtx.sessionId);
    if (revokeResult instanceof Error) {
      console.error("サインアウト時のセッション無効化に失敗しました。", {
        message: revokeResult.message,
      });
      return respondWithError(
        new AuthError({
          message: "Failed to sign out.",
          code: "session-revocation-failed",
          statusCode: 500,
          cause: revokeResult,
        }),
        c,
      );
    }

    clearOpaqueSessionCookie(c);
    return c.body(null, 204);
  })
  .get("/api/auth/google", rateLimitByIp("AUTH_GOOGLE_RATE_LIMITER"), googleOAuthRedirect)
  .get("/api/auth/google/callback", googleOAuthCallback);

export { auth };
