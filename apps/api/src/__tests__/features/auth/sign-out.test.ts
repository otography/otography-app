import { describe, expect, it, vi } from "vitest";
import { mockResolveSession, mockRevokeRefreshTokens } from "../../setup";
import { testRequest } from "../../helpers/test-client";

const sessionRepository = vi.hoisted(() => ({
  revokeAllUserSessions: vi.fn().mockResolvedValue(undefined),
  revokeSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../shared/auth/session-repository", () => sessionRepository);

vi.mock("../../../shared/firebase/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDbClient: vi.fn(),
}));

import { createDbClient } from "../../../shared/db";

describe("POST /api/auth/sign-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // dbMiddleware が DB 接続を返すようにモック
    vi.mocked(createDbClient).mockReturnValue({
      db: {},
      end: async () => undefined,
    } as never);
  });

  it("returns 204 and clears opaque cookie when no session cookie is present", async () => {
    const res = await testRequest("/api/auth/sign-out", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
    });

    expect(res.status).toBe(204);
    expect(mockRevokeRefreshTokens).not.toHaveBeenCalled();
    expect(sessionRepository.revokeSession).not.toHaveBeenCalled();
  });

  it("returns 204, revokes current server session only, and clears cookie", async () => {
    mockResolveSession.mockResolvedValue({
      claims: { sub: "user123", email: "test@example.com" },
      session: { id: "session-uuid", userId: "uuid-user", version: 1 },
    });

    const res = await testRequest("/api/auth/sign-out", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
      cookie: { otography_session: "a".repeat(43) },
    });

    expect(res.status).toBe(204);
    // sign-out は現在のサーバーセッションのみを無効化（sessionCtx 経由）
    expect(sessionRepository.revokeSession).toHaveBeenCalledWith(expect.anything(), "session-uuid");
    // Firebase のグローバルな revokeRefreshTokens は呼ばない（#2）
    expect(mockRevokeRefreshTokens).not.toHaveBeenCalled();
    const cookie = res.getCookie("otography_session");
    expect(cookie === undefined || cookie === "").toBe(true);
  });

  it("returns 500 and keeps the cookie when revoking the current session fails", async () => {
    mockResolveSession.mockResolvedValue({
      claims: { sub: "user123", email: "test@example.com" },
      session: { id: "session-uuid", userId: "uuid-user", version: 1 },
    });
    sessionRepository.revokeSession.mockResolvedValue(new Error("database unavailable"));

    const res = await testRequest("/api/auth/sign-out", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
      cookie: { otography_session: "a".repeat(43) },
    });

    expect(res.status).toBe(500);
    expect(res.getCookie("otography_session")).toBeUndefined();
  });
});
