import { describe, expect, it, vi } from "vitest";
import {
  mockClearRefreshTokenCookie,
  mockCreateSessionCookie,
  mockExchangeRefreshToken,
  mockGetRefreshTokenCookie,
  mockSetRefreshTokenCookie,
  mockVerifySessionCookie,
} from "../../setup";
import { testRequest } from "../../helpers/test-client";

vi.mock("../../../shared/firebase/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDb: vi.fn(),
}));

import { createDb } from "../../../shared/db";

// リフレッシュ成功時にルートハンドラがDBにアクセスするためのモック
const mockDbWithRls = (uuid: string, txMethods: Record<string, unknown>) => {
  vi.mocked(createDb).mockReturnValue({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: uuid }]),
        })),
      })),
    })),
    transaction: vi.fn(async (fn) => fn(txMethods)),
  } as never);
};

const defaultDbTx = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue([
          {
            id: "uuid-user",
            firebaseId: "user123",
            username: "test",
            name: null,
            bio: null,
            birthplace: null,
            birthyear: null,
            gender: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            deletedAt: null,
          },
        ]),
      })),
    })),
  })),
  execute: vi.fn().mockResolvedValue([]),
};

// authSessionMiddleware → requireAuthMiddleware の順で実行されるため、
// リフレッシュパスのテストには requireAuthMiddleware を使うルート（GET /api/user）を使用する。
// authSessionMiddleware は authSession を設定せず next() を呼ぶだけなので、
// requireAuthMiddleware 側でリフレッシュが実行される。

describe("Session refresh on protected route (GET /api/user)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("no session cookie + refresh token present", () => {
    it("succeeds when refresh token exchange succeeds", async () => {
      mockGetRefreshTokenCookie.mockResolvedValue("valid-refresh-token");
      mockExchangeRefreshToken.mockResolvedValue({
        id_token: "new-id-token",
        refresh_token: "new-refresh-token",
      });
      mockCreateSessionCookie.mockResolvedValue("new-session-cookie");
      mockVerifySessionCookie.mockResolvedValue({
        sub: "user123",
        email: "test@example.com",
      });
      mockDbWithRls("uuid-user", defaultDbTx);

      const res = await testRequest("/api/user");

      // リフレッシュ成功 → 新しいセッションcookieとrefresh token cookieが設定される
      expect(mockExchangeRefreshToken).toHaveBeenCalledWith(
        expect.any(String),
        "valid-refresh-token",
      );
      expect(mockCreateSessionCookie).toHaveBeenCalled();
      expect(mockSetRefreshTokenCookie).toHaveBeenCalledWith(
        expect.anything(),
        "new-refresh-token",
      );
      // requireAuthMiddleware が authSession をセットするのでルートハンドラに到達
      expect(res.status).toBe(200);
    });

    it("returns 401 when refresh token exchange fails", async () => {
      mockGetRefreshTokenCookie.mockResolvedValue("expired-refresh-token");
      const { AuthRestError } = await import("@repo/errors");
      mockExchangeRefreshToken.mockResolvedValue(
        new AuthRestError({ message: "Token expired.", statusCode: 401 }),
      );

      const res = await testRequest("/api/user");

      expect(res.status).toBe(401);
      // リフレッシュ失敗時は両方のcookieをクリア
      expect(mockClearRefreshTokenCookie).toHaveBeenCalled();
    });

    it("returns 401 when no refresh token cookie is present", async () => {
      mockGetRefreshTokenCookie.mockResolvedValue(null);

      const res = await testRequest("/api/user");

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ message: "You are not logged in." });
      expect(mockExchangeRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe("invalid session cookie + refresh token present", () => {
    it("succeeds when refresh restores the session", async () => {
      // 最初の呼び出し（authSessionMiddleware）はAuthErrorを返す、
      // 2回目の呼び出し（refreshSession内）は成功させる
      const { AuthError } = await import("@repo/errors/server");
      mockVerifySessionCookie
        .mockResolvedValueOnce(
          new AuthError({
            message: "Session expired.",
            code: "auth/session-cookie-expired",
            statusCode: 401,
          }),
        )
        .mockResolvedValue({
          sub: "user123",
          email: "test@example.com",
        });
      mockGetRefreshTokenCookie.mockResolvedValue("valid-refresh-token");
      mockExchangeRefreshToken.mockResolvedValue({
        id_token: "new-id-token",
        refresh_token: "new-refresh-token",
      });
      mockCreateSessionCookie.mockResolvedValue("new-session-cookie");
      mockDbWithRls("uuid-user", defaultDbTx);

      const res = await testRequest("/api/user", {
        cookie: { otography_session: "expired-session" },
      });

      expect(mockExchangeRefreshToken).toHaveBeenCalled();
      expect(mockSetRefreshTokenCookie).toHaveBeenCalledWith(
        expect.anything(),
        "new-refresh-token",
      );
      expect(res.status).toBe(200);
    });

    it("returns refresh error when both session and refresh fail", async () => {
      const { AuthError } = await import("@repo/errors/server");
      mockVerifySessionCookie.mockResolvedValue(
        new AuthError({
          message: "Session expired.",
          code: "auth/session-cookie-expired",
          statusCode: 401,
        }),
      );
      mockGetRefreshTokenCookie.mockResolvedValue("expired-refresh-token");
      const { AuthRestError } = await import("@repo/errors");
      mockExchangeRefreshToken.mockResolvedValue(
        new AuthRestError({ message: "Token expired.", statusCode: 401 }),
      );

      const res = await testRequest("/api/user", {
        cookie: { otography_session: "expired-session" },
      });

      // リフレッシュのエラーが優先して返される
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ message: "Token expired." });
      // リフレッシュ失敗時は両方のcookieをクリア
      expect(mockClearRefreshTokenCookie).toHaveBeenCalled();
    });
  });
});
