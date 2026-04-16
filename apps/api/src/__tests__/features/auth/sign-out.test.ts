import { describe, expect, it, vi } from "vitest";
import {
  mockClearRefreshTokenCookie,
  mockRevokeRefreshTokens,
  mockVerifySessionCookie,
} from "../../setup";
import { testRequest } from "../../helpers/test-client";

vi.mock("../../../shared/firebase/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDb: vi.fn(() => ({ transaction: vi.fn() })),
}));

describe("POST /api/auth/sign-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 204 and clears both cookies when no session cookie is present", async () => {
    const res = await testRequest("/api/auth/sign-out", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
    });

    expect(res.status).toBe(204);
    expect(mockRevokeRefreshTokens).not.toHaveBeenCalled();
    expect(mockClearRefreshTokenCookie).toHaveBeenCalled();
  });

  it("returns 204 and clears both cookies when session is valid", async () => {
    mockVerifySessionCookie.mockResolvedValue({ sub: "user123", email: "test@example.com" });
    mockRevokeRefreshTokens.mockResolvedValue(undefined);

    const res = await testRequest("/api/auth/sign-out", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
      cookie: { otography_session: "valid-session", otography_refresh_token: "encrypted-rt" },
    });

    expect(res.status).toBe(204);
    expect(mockRevokeRefreshTokens).toHaveBeenCalledWith("user123");
    // セッションcookieが削除されている（値が空 or Deleteマーカー）
    const sessionCookie = res.getCookie("otography_session");
    expect(sessionCookie === undefined || sessionCookie === "").toBe(true);
    expect(mockClearRefreshTokenCookie).toHaveBeenCalled();
  });

  it("returns 502 when revokeRefreshTokens fails without clearCookie", async () => {
    mockVerifySessionCookie.mockResolvedValue({ sub: "user123", email: "test@example.com" });
    mockRevokeRefreshTokens.mockRejectedValue(new Error("Firebase error"));

    const res = await testRequest("/api/auth/sign-out", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
      cookie: { otography_session: "valid-session" },
    });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ message: "Failed to sign you out." });
  });
});
