import { describe, expect, it, vi } from "vitest";
import { mockCreateSessionCookie, mockVerifyIdToken } from "../../setup";
import { testRequest } from "../../helpers/test-client";

vi.mock("../../../shared/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDb: vi.fn(),
}));

import { signUpWithPassword } from "../../../shared/firebase-rest";
import { createDb } from "../../../shared/db";

// withRls が createDb().transaction() → tx.execute() × 2 → callback(tx) の順で呼ぶためのモック
const mockDbWithTransaction = (txMethods: Record<string, unknown>) => {
  vi.mocked(createDb).mockReturnValue({
    transaction: vi.fn(async (fn) => fn(txMethods)),
  } as never);
};

const defaultTx = {
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      onConflictDoNothing: vi.fn().mockResolvedValue([]),
    })),
  })),
  execute: vi.fn().mockResolvedValue([]),
};

describe("POST /api/auth/sign-up", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbWithTransaction(defaultTx);
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
    it("returns 500 when app user registration fails", async () => {
      vi.mocked(signUpWithPassword).mockResolvedValue({
        idToken: "test-id-token",
        localId: "user123",
        expiresIn: "3600",
        refreshToken: "test-refresh",
      });
      mockVerifyIdToken.mockResolvedValue({
        sub: "user123",
        email: "test@example.com",
      });
      mockDbWithTransaction({
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn().mockRejectedValue(new Error("DB error")),
          })),
        })),
        execute: vi.fn().mockResolvedValue([]),
      });

      const res = await testRequest("/api/auth/sign-up", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ message: "Failed to create user record." });
    });

    it("returns 502 when createSessionCookie fails", async () => {
      vi.mocked(signUpWithPassword).mockResolvedValue({
        idToken: "test-id-token",
        localId: "user123",
        expiresIn: "3600",
        refreshToken: "test-refresh",
      });
      mockVerifyIdToken.mockResolvedValue({
        sub: "user123",
        email: "test@example.com",
      });
      mockCreateSessionCookie.mockRejectedValue(new Error("Firebase error"));

      const res = await testRequest("/api/auth/sign-up", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(502);
    });
  });

  describe("success", () => {
    it("returns 201 with session cookie", async () => {
      vi.mocked(signUpWithPassword).mockResolvedValue({
        idToken: "test-id-token",
        localId: "user123",
        expiresIn: "3600",
        refreshToken: "test-refresh",
        isNewUser: true,
      });
      mockVerifyIdToken.mockResolvedValue({
        sub: "user123",
        email: "test@example.com",
      });
      mockCreateSessionCookie.mockResolvedValue("test-session-cookie");

      const res = await testRequest("/api/auth/sign-up", {
        method: "POST",
        body: { email: "test@example.com", password: "password123" },
      });

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ message: "Account created successfully." });
      expect(res.getCookie("otography_session")).toBe("test-session-cookie");
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
