import { Hono } from "hono";
import { csrfProtection, rateLimitByIp } from "../../shared/middleware";
import { clearOpaqueSessionCookie, setOpaqueSessionCookie } from "../../shared/auth/opaque-cookie";
import { respondWithError } from "../../shared/errors/error-response";
import type { Env } from "../../shared/types/env";
import { credentialsValidator } from "./model/credentials";
import { handleAuthError } from "./lib/auth-error-response";
import { signInWithEmail, signUpWithEmail } from "./usecase/email-signin";
import { signOut } from "./usecase/sign-out";
import { googleOAuthRedirect, googleOAuthCallback } from "./lib/google";

const auth = new Hono<Env>()
  .post(
    "/api/auth/sign-in",
    csrfProtection(),
    rateLimitByIp("AUTH_SIGNIN_RATE_LIMITER"),
    credentialsValidator,
    async (c) => {
      const { email, password } = c.req.valid("json");
      const result = await signInWithEmail({
        apiKey: c.env.FIREBASE_API_KEY,
        email,
        password,
        db: c.var.db(),
      });
      if (result instanceof Error) return handleAuthError(result, c);

      // オペークCookieのみを設定（Firebaseクレデンシャルはブラウザに置かない）
      setOpaqueSessionCookie(c, result.opaqueId);
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
      const result = await signUpWithEmail({
        apiKey: c.env.FIREBASE_API_KEY,
        email,
        password,
        db: c.var.db(),
      });
      if (result instanceof Error) return handleAuthError(result, c);

      setOpaqueSessionCookie(c, result.opaqueId);
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
    const result = await signOut({ db: c.var.db(), sessionId: sessionCtx.sessionId });
    if (result instanceof Error) {
      return respondWithError(result, c);
    }

    clearOpaqueSessionCookie(c);
    return c.body(null, 204);
  })
  .get("/api/auth/google", rateLimitByIp("AUTH_GOOGLE_RATE_LIMITER"), googleOAuthRedirect)
  .get("/api/auth/google/callback", googleOAuthCallback);

export { auth };
