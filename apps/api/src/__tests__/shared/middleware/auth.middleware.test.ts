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
import { mockVerifySessionCookie, mockGetRefreshTokenCookie } from "../../setup";
import { AuthError } from "@repo/errors/server";

// FirebaseAuthError モックをインポート（setup.ts で定義済み）
import { FirebaseAuthError } from "@repo/firebase-auth-rest/auth";

// セッション cookie の取得をモック
const mockSessionCookie = { value: "valid-session-cookie" };

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
