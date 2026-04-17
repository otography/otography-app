import { describe, expect, it, vi } from "vitest";
import { mockCreateSessionCookie, mockSetRefreshTokenCookie } from "../../setup";
import { testRequest } from "../../helpers/test-client";

vi.mock("../../../shared/firebase/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDb: vi.fn(() => ({ transaction: vi.fn() })),
}));

import { signInWithPassword } from "../../../shared/firebase/firebase-rest";

describe("POST /api/auth/sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(await res.json()).toEqual({ message: "Invalid email address or password." });
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
      expect(await res.json()).toEqual({ message: "Session creation failed." });
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
        message: "Please provide a valid email address and a password with at least 6 characters.",
      });
    });
  });
});
