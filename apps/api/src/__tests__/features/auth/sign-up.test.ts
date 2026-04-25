import { describe, expect, it, vi } from "vitest";
import {
  mockCreateSessionCookie,
  mockCreateCustomToken,
  mockExchangeCustomToken,
  mockSetCustomUserClaims,
  mockSetRefreshTokenCookie,
} from "../../setup";
import { testRequest } from "../../helpers/test-client";

vi.mock("../../../shared/firebase/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDb: vi.fn(),
}));

import { signUpWithPassword } from "../../../shared/firebase/firebase-rest";
import { createDb } from "../../../shared/db";

// DB INSERT 用のモック (sign-up でユーザーレコード作成)
const mockDbWithInsert = (resolvedValue: unknown[]) => {
  vi.mocked(createDb).mockReturnValue({
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue(resolvedValue),
      })),
    })),
  } as never);
};

describe("POST /api/auth/sign-up", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("error passthrough", () => {
    it("returns 401 when signUpWithPassword returns AuthRestError", async () => {
      const { AuthRestError } = await import("@repo/errors");
      vi.mocked(signUpWithPassword).mockResolvedValue(
        new AuthRestError({ message: "Invalid email address or password.", statusCode: 401 }),
      );

      const res = await testRequest("/api/auth/sign-up", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(401);
    });

    it("returns 409 when email already exists", async () => {
      const { AuthRestError } = await import("@repo/errors");
      vi.mocked(signUpWithPassword).mockResolvedValue(
        new AuthRestError({
          message: "This email address is already registered.",
          statusCode: 409,
        }),
      );

      const res = await testRequest("/api/auth/sign-up", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(409);
    });
  });

  describe("upstream dependency failure", () => {
    it("returns 502 when createSessionCookie fails", async () => {
      const { AuthError } = await import("@repo/errors/server");
      vi.mocked(signUpWithPassword).mockResolvedValue({
        idToken: "test-id-token",
        localId: "user123",
        expiresIn: "3600",
        refreshToken: "test-refresh",
      });
      mockDbWithInsert([
        {
          id: "uuid-user",
          firebaseId: "user123",
          username: null,
          name: null,
          bio: null,
          birthplace: null,
          birthyear: null,
          gender: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          deletedAt: null,
        },
      ]);
      mockSetCustomUserClaims.mockResolvedValue(undefined);
      mockCreateCustomToken.mockResolvedValue("custom-token");
      mockExchangeCustomToken.mockResolvedValue({
        idToken: "fresh-id-token",
        refreshToken: "new-refresh",
        expiresIn: "3600",
        isNewUser: true,
      });
      mockCreateSessionCookie.mockResolvedValue(
        new AuthError({
          message: "Session creation failed.",
          code: "session-failed",
          statusCode: 502,
        }),
      );

      const res = await testRequest("/api/auth/sign-up", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(502);
    });

    it("returns 500 when DB insert fails", async () => {
      vi.mocked(signUpWithPassword).mockResolvedValue({
        idToken: "test-id-token",
        localId: "user123",
        expiresIn: "3600",
        refreshToken: "test-refresh",
      });
      // DB INSERT が失敗するモック
      vi.mocked(createDb).mockReturnValue({
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockRejectedValue(new Error("DB error")),
          })),
        })),
      } as never);

      const res = await testRequest("/api/auth/sign-up", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(500);
    });

    it("returns 502 when setCustomUserClaims fails", async () => {
      const { AuthError } = await import("@repo/errors/server");
      vi.mocked(signUpWithPassword).mockResolvedValue({
        idToken: "test-id-token",
        localId: "user123",
        expiresIn: "3600",
        refreshToken: "test-refresh",
      });
      mockDbWithInsert([
        {
          id: "uuid-user",
          firebaseId: "user123",
          username: null,
          name: null,
          bio: null,
          birthplace: null,
          birthyear: null,
          gender: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          deletedAt: null,
        },
      ]);
      mockSetCustomUserClaims.mockResolvedValue(
        new AuthError({
          message: "Failed to set custom claims.",
          code: "claims-failed",
          statusCode: 502,
        }),
      );

      const res = await testRequest("/api/auth/sign-up", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(502);
    });

    it("returns 502 when createCustomToken fails", async () => {
      vi.mocked(signUpWithPassword).mockResolvedValue({
        idToken: "test-id-token",
        localId: "user123",
        expiresIn: "3600",
        refreshToken: "test-refresh",
      });
      mockDbWithInsert([
        {
          id: "uuid-user",
          firebaseId: "user123",
          username: null,
          name: null,
          bio: null,
          birthplace: null,
          birthyear: null,
          gender: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          deletedAt: null,
        },
      ]);
      mockSetCustomUserClaims.mockResolvedValue(undefined);
      mockCreateCustomToken.mockResolvedValue(
        new (await import("@repo/errors/server")).AuthError({
          message: "Failed to create custom token.",
          code: "custom-token-failed",
          statusCode: 502,
        }),
      );

      const res = await testRequest("/api/auth/sign-up", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(502);
    });

    it("returns error when exchangeCustomToken fails", async () => {
      const { AuthRestError } = await import("@repo/errors");
      vi.mocked(signUpWithPassword).mockResolvedValue({
        idToken: "test-id-token",
        localId: "user123",
        expiresIn: "3600",
        refreshToken: "test-refresh",
      });
      mockDbWithInsert([
        {
          id: "uuid-user",
          firebaseId: "user123",
          username: null,
          name: null,
          bio: null,
          birthplace: null,
          birthyear: null,
          gender: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          deletedAt: null,
        },
      ]);
      mockSetCustomUserClaims.mockResolvedValue(undefined);
      mockCreateCustomToken.mockResolvedValue("custom-token");
      mockExchangeCustomToken.mockResolvedValue(
        new AuthRestError({ message: "Custom token exchange failed.", statusCode: 401 }),
      );

      const res = await testRequest("/api/auth/sign-up", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(401);
    });
  });

  describe("success", () => {
    it("returns 201 with session cookie and refresh token cookie", async () => {
      vi.mocked(signUpWithPassword).mockResolvedValue({
        idToken: "test-id-token",
        localId: "user123",
        expiresIn: "3600",
        refreshToken: "test-refresh",
        isNewUser: true,
      });
      mockDbWithInsert([
        {
          id: "uuid-user",
          firebaseId: "user123",
          username: null,
          name: null,
          bio: null,
          birthplace: null,
          birthyear: null,
          gender: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          deletedAt: null,
        },
      ]);
      mockSetCustomUserClaims.mockResolvedValue(undefined);
      mockCreateCustomToken.mockResolvedValue("custom-token");
      mockExchangeCustomToken.mockResolvedValue({
        idToken: "fresh-id-token",
        refreshToken: "exchanged-refresh",
        expiresIn: "3600",
        isNewUser: true,
      });
      mockCreateSessionCookie.mockResolvedValue("test-session-cookie");

      const res = await testRequest("/api/auth/sign-up", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ message: "Account created successfully." });
      expect(res.getCookie("otography_session")).toBe("test-session-cookie");
      // setCustomUserClaims が db_uuid 付きで呼ばれたことを確認
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith("user123", {
        db_uuid: "uuid-user",
      });
      // exchangeCustomToken が呼ばれたことを確認
      expect(mockExchangeCustomToken).toHaveBeenCalled();
      // リフレッシュトークンは交換で得られたものを使用
      expect(mockSetRefreshTokenCookie).toHaveBeenCalledWith(
        expect.anything(),
        "exchanged-refresh",
      );
    });
  });

  describe("input validation", () => {
    it("returns 400 for invalid credentials", async () => {
      const res = await testRequest("/api/auth/sign-up", {
        method: "POST",
        body: { email: "not-an-email", password: "12345" },
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        message: "Please provide a valid email address and a password with at least 6 characters.",
      });
    });
  });
});
