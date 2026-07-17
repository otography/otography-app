import { describe, expect, it, vi } from "vitest";
import { mockCreateSessionCookie, mockSetRefreshTokenCookie } from "../../setup";
import { testRequest } from "../../helpers/test-client";

vi.mock("../../../shared/firebase/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDbClient: vi.fn(),
}));

// レートリミットミドルウェアをバイパス（レートリミットテストは別ファイルで実施）
vi.mock("../../../shared/middleware/rate-limit.middleware", () => ({
  rateLimitByIp: () => async (_c: unknown, next: () => Promise<void>) => await next(),
  rateLimitByUser: () => async (_c: unknown, next: () => Promise<void>) => await next(),
}));

import { signInWithPassword } from "../../../shared/firebase/firebase-rest";
import { createDbClient } from "../../../shared/db";

const mockDbWithUserInsert = (rows: unknown[] = [{ id: "uuid-user" }]) => {
  vi.mocked(createDbClient).mockReturnValue({
    db: {
      execute: vi.fn(() => Promise.resolve([])),
      transaction: vi.fn(async (fn) =>
        fn({
          execute: vi.fn(() => Promise.resolve(rows)),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              onConflictDoUpdate: vi.fn(() => ({
                returning: vi.fn().mockResolvedValue(rows),
              })),
            })),
          })),
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue(rows),
              })),
            })),
          })),
        }),
      ),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue(rows),
          })),
        })),
      })),
    },
    end: async () => undefined,
  } as never);
};

describe("POST /api/auth/sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbWithUserInsert();
  });

  describe("error passthrough", () => {
    it("returns 401 when signInWithPassword returns AuthRestError", async () => {
      const { AuthRestError } = await import("@repo/errors");
      vi.mocked(signInWithPassword).mockResolvedValue(
        new AuthRestError({ message: "Invalid email address or password.", statusCode: 401 }),
      );

      const res = await testRequest("/api/auth/sign-in", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toMatchObject({
        type: "https://api.otography.com/errors/unauthorized",
        title: "Unauthorized",
        status: 401,
        detail: "Invalid email address or password.",
      });
    });

    it("returns 409 when email already exists", async () => {
      const { AuthRestError } = await import("@repo/errors");
      vi.mocked(signInWithPassword).mockResolvedValue(
        new AuthRestError({
          message: "This email address is already registered.",
          statusCode: 409,
        }),
      );

      const res = await testRequest("/api/auth/sign-in", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(409);
    });
  });

  describe("upstream dependency failure", () => {
    it("returns 502 when createSessionCookie fails", async () => {
      const { AuthError } = await import("@repo/errors/server");
      vi.mocked(signInWithPassword).mockResolvedValue({
        idToken: "test-id-token",
        localId: "user123",
        expiresIn: "3600",
        refreshToken: "test-refresh",
      });
      mockCreateSessionCookie.mockResolvedValue(
        new AuthError({
          message: "Session creation failed.",
          code: "session-failed",
          statusCode: 502,
        }),
      );

      const res = await testRequest("/api/auth/sign-in", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(502);
      expect(await res.json()).toMatchObject({
        type: "https://api.otography.com/errors/bad-gateway",
        title: "Bad Gateway",
        status: 502,
        detail: "Session creation failed.",
      });
    });

    it("returns 500 when user record creation fails", async () => {
      vi.mocked(signInWithPassword).mockResolvedValue({
        idToken: "test-id-token",
        localId: "user123",
        expiresIn: "3600",
        refreshToken: "test-refresh",
      });
      mockCreateSessionCookie.mockResolvedValue("test-session-cookie");
      vi.mocked(createDbClient).mockReturnValue({
        db: {
          transaction: vi.fn(async (fn) =>
            fn({
              execute: vi.fn().mockRejectedValue(new Error("db unavailable")),
              insert: vi.fn(() => ({
                values: vi.fn(() => ({
                  onConflictDoUpdate: vi.fn(() => ({
                    returning: vi.fn().mockRejectedValue(new Error("db unavailable")),
                  })),
                })),
              })),
            }),
          ),
        },
        end: async () => undefined,
      } as never);

      const res = await testRequest("/api/auth/sign-in", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({
        type: "https://api.otography.com/errors/internal-error",
        title: "Internal Server Error",
        status: 500,
        detail: "Failed to create user record.",
      });
      expect(res.getCookie("otography_session")).toBeUndefined();
    });
  });

  describe("success", () => {
    it("returns 200 with session cookie and refresh token cookie", async () => {
      vi.mocked(signInWithPassword).mockResolvedValue({
        idToken: "test-id-token",
        localId: "user123",
        expiresIn: "3600",
        refreshToken: "test-refresh",
      });
      mockCreateSessionCookie.mockResolvedValue("test-session-cookie");

      const res = await testRequest("/api/auth/sign-in", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ message: "Signed in successfully." });
      expect(res.getCookie("otography_session")).toBe("test-session-cookie");
      expect(mockSetRefreshTokenCookie).toHaveBeenCalledWith(expect.anything(), "test-refresh");
      expect(createDbClient).toHaveBeenCalled();
    });
  });

  describe("input validation", () => {
    it("returns 400 for invalid credentials", async () => {
      const res = await testRequest("/api/auth/sign-in", {
        method: "POST",
        body: { email: "not-an-email", password: "12345" },
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        type: "https://api.otography.com/errors/bad-request",
        title: "Bad Request",
        status: 400,
        detail: "Please provide a valid email address and a password with at least 6 characters.",
      });
    });
  });
});
