/**
 * テストリスト: Auth ミドルウェアのドメイン固有 problem type URI（VAL-MW-001）
 *
 * - session-expired: verifySessionCookie が auth/session-cookie-expired を返す → type: .../session-expired
 * - session-revoked: verifySessionCookie が auth/session-cookie-revoked を返す → type: .../session-revoked
 * - session-invalid (argument-error): verifySessionCookie が auth/argument-error を返す → type: .../session-invalid
 * - session-invalid (user-not-found): verifySessionCookie が auth/user-not-found を返す → type: .../session-invalid
 * - account-disabled: verifySessionCookie が auth/user-disabled を返す → type: .../account-disabled (403)
 * - auth-service-unavailable: verifySessionCookie が auth/internal-error を返す → type: .../auth-service-unavailable (503)
 */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockExchangeRefreshToken,
  mockGetRefreshTokenCookie,
  mockVerifySessionCookie,
  mockVerifySessionCookieStrict,
} from "../../setup";
import { AuthError } from "@repo/errors/server";
import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import type { Env } from "../../../shared/types/env";

// FirebaseAuthError モックをインポート（setup.ts で定義済み）
import { FirebaseAuthError } from "@repo/firebase-auth-rest/auth";

// セッション cookie の取得をモック
const mockSessionCookie = { value: "valid-session-cookie" as string | null };
const authSession: DecodedIdToken = {
  aud: "test-project",
  auth_time: 0,
  exp: 0,
  firebase: { identities: {}, sign_in_provider: "password" },
  iat: 0,
  iss: "https://securetoken.google.com/test-project",
  sub: "user123",
  uid: "user123",
  email: "test@example.com",
};

vi.mock("../../../shared/auth/session-cookie", () => ({
  getSessionCookie: () => mockSessionCookie.value,
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
}));

// getAuthSession をモック
vi.mock("../../../shared/auth/auth-session", () => ({
  getAuthSession: () => null,
}));

// モック適用後にテスト対象をインポート
import {
  authSessionMiddleware,
  requireAuthMiddleware,
  requireFreshSessionMiddleware,
} from "../../../shared/middleware/auth.middleware";

/**
 * Firebase エラーコード → 期待されるドメイン固有 type URI のマッピング
 */
const firebaseCodeToExpectedType: Array<{
  firebaseCode: string;
  expectedTypeUri: string;
  expectedStatus: number;
}> = [
  {
    firebaseCode: "session-cookie-expired",
    expectedTypeUri: "https://api.otography.com/errors/session-expired",
    expectedStatus: 401,
  },
  {
    firebaseCode: "session-cookie-revoked",
    expectedTypeUri: "https://api.otography.com/errors/session-revoked",
    expectedStatus: 401,
  },
  {
    firebaseCode: "argument-error",
    expectedTypeUri: "https://api.otography.com/errors/session-invalid",
    expectedStatus: 401,
  },
  {
    firebaseCode: "user-not-found",
    expectedTypeUri: "https://api.otography.com/errors/session-invalid",
    expectedStatus: 401,
  },
  {
    firebaseCode: "user-disabled",
    expectedTypeUri: "https://api.otography.com/errors/account-disabled",
    expectedStatus: 403,
  },
  {
    firebaseCode: "internal-error",
    expectedTypeUri: "https://api.otography.com/errors/auth-service-unavailable",
    expectedStatus: 503,
  },
];

describe("Auth ミドルウェアのドメイン固有 problem type URI（VAL-MW-001）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionCookie.value = "valid-session-cookie";
  });

  it.each(firebaseCodeToExpectedType)(
    "$firebaseCode → type: $expectedTypeUri, status: $expectedStatus",
    async ({ firebaseCode, expectedTypeUri, expectedStatus }) => {
      // setup.ts の FirebaseAuthError モックは "auth/" プレフィックスを付与するので、
      // code 部分のみを渡す。AuthError.fromFirebase() が problemSlug を設定する。
      const firebaseError = new FirebaseAuthError({
        code: firebaseCode,
        message: `Firebase error: ${firebaseCode}`,
      });
      const authError = AuthError.fromFirebase(firebaseError, "Session verification failed.");

      // verifySessionCookie が AuthError を返す。
      // authSessionMiddleware と requireAuthMiddleware の両方で呼ばれるため
      // mockResolvedValue を使用して全呼び出しで同じエラーを返す。
      mockVerifySessionCookie.mockResolvedValue(authError);

      // refresh token なし → refreshSession は null を返す（全呼び出しで null）
      mockGetRefreshTokenCookie.mockResolvedValue(null);

      const app = new Hono();
      app.use(authSessionMiddleware());
      app.use(requireAuthMiddleware());
      app.get("/protected", (c) => c.json({ ok: true }));

      const res = await app.request("http://localhost/protected");

      expect(res.status).toBe(expectedStatus);
      const body = await res.json();
      expect(body).toMatchObject({
        type: expectedTypeUri,
        status: expectedStatus,
      });
    },
  );
});

/**
 * テストリスト: requireFreshSessionMiddleware（MUS-27）
 *
 * - 厳格検証成功 → next() 実行（200）
 * - session-cookie-revoked → 401、problem type .../session-revoked
 * - user-disabled → 403、problem type .../account-disabled
 * - 厳格検証失敗でも refreshSession 成功 → 通過（200）
 * - クッキーなし・authSession なし → 401
 * - クッキーなし・authSession あり（refresh 経由）→ 通過
 */

describe("requireFreshSessionMiddleware（MUS-27）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionCookie.value = "valid-session-cookie";
    mockGetRefreshTokenCookie.mockResolvedValue(null);
  });

  it("厳格検証成功 → next() 実行（200）", async () => {
    mockVerifySessionCookieStrict.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
    });

    const app = new Hono<Env>();
    // authSession が設定済み（requireAuthMiddleware 通過済み）を想定
    app.use((c, next) => {
      c.set("authSession", authSession);
      return next();
    });
    app.use(requireFreshSessionMiddleware());
    app.delete("/sensitive", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/sensitive", { method: "DELETE" });

    expect(res.status).toBe(200);
    expect(mockVerifySessionCookieStrict).toHaveBeenCalledWith("valid-session-cookie");
  });

  it("session-cookie-revoked → 401、problem type .../session-revoked", async () => {
    const firebaseError = new FirebaseAuthError({
      code: "session-cookie-revoked",
      message: "The session cookie has been revoked.",
    });
    const authError = AuthError.fromFirebase(firebaseError, "Session verification failed.");
    mockVerifySessionCookieStrict.mockResolvedValue(authError);

    const app = new Hono<Env>();
    app.use((c, next) => {
      c.set("authSession", authSession);
      return next();
    });
    app.use(requireFreshSessionMiddleware());
    app.delete("/sensitive", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/sensitive", { method: "DELETE" });

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/session-revoked",
      status: 401,
    });
  });

  it("user-disabled → 403、problem type .../account-disabled", async () => {
    const firebaseError = new FirebaseAuthError({
      code: "user-disabled",
      message: "The user record is disabled.",
    });
    const authError = AuthError.fromFirebase(firebaseError, "Session verification failed.");
    mockVerifySessionCookieStrict.mockResolvedValue(authError);

    const app = new Hono<Env>();
    app.use((c, next) => {
      c.set("authSession", authSession);
      return next();
    });
    app.use(requireFreshSessionMiddleware());
    app.delete("/sensitive", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/sensitive", { method: "DELETE" });

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/account-disabled",
      status: 403,
    });
  });

  it("厳格検証失敗でも refreshSession 成功 → 通過（200）", async () => {
    // 期限切れクッキー → strict 失敗
    const expiredError = new FirebaseAuthError({
      code: "session-cookie-expired",
      message: "Expired.",
    });
    mockVerifySessionCookieStrict.mockResolvedValue(
      AuthError.fromFirebase(expiredError, "Session verification failed."),
    );

    // refresh token あり → refreshSession 成功（通常 verifySessionCookie 経由）
    mockGetRefreshTokenCookie.mockResolvedValue("valid-refresh-token");
    mockExchangeRefreshToken.mockResolvedValue({
      id_token: "new-id-token",
      refresh_token: "new-refresh-token",
    });
    mockVerifySessionCookie.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
    });

    const app = new Hono<Env>();
    app.use((c, next) => {
      c.set("authSession", authSession);
      return next();
    });
    app.use(requireFreshSessionMiddleware());
    app.delete("/sensitive", (c) => c.json({ ok: true }));

    const res = await app.request(
      "http://localhost/sensitive",
      { method: "DELETE" },
      // refreshSession が c.env.FIREBASE_API_KEY にアクセスするため env を明示的に渡す
      { FIREBASE_API_KEY: "test-api-key" } as never,
    );

    expect(res.status).toBe(200);
  });

  it("クッキーなし・authSession なし → 401", async () => {
    mockSessionCookie.value = null;

    const app = new Hono<Env>();
    // authSession も未設定
    app.use(requireFreshSessionMiddleware());
    app.delete("/sensitive", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/sensitive", { method: "DELETE" });

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/unauthorized",
      status: 401,
    });
  });

  it("クッキーなし・authSession あり（refresh 経由）→ 通過", async () => {
    mockSessionCookie.value = null;

    const app = new Hono<Env>();
    // refresh 経由で認証済み（authSession あり、クッキーはブラウザ側で削除済み）
    app.use((c, next) => {
      c.set("authSession", authSession);
      return next();
    });
    app.use(requireFreshSessionMiddleware());
    app.delete("/sensitive", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/sensitive", { method: "DELETE" });

    expect(res.status).toBe(200);
    // クッキーがないため strict 検証は呼ばれない
    expect(mockVerifySessionCookieStrict).not.toHaveBeenCalled();
  });
});
