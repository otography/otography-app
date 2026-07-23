import { describe, expect, it, vi } from "vitest";
import { mockResolveSession } from "../../setup";
import { testRequest } from "../../helpers/test-client";

// テスト用にfirebase-restをモック
vi.mock("../../../shared/firebase/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDbClient: vi.fn(() => ({ db: { transaction: vi.fn() }, end: async () => undefined })),
}));

describe("authSessionMiddleware スコープ (VAL-MW-001, VAL-MW-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("VAL-MW-002: healthエンドポイントはauthSessionミドルウェアをバイパスする", () => {
    it("GET /api/health にcookie付きでアクセスしてもresolveSessionが呼ばれない", async () => {
      // cookie付きでリクエスト — もしauthSessionMiddlewareが動いていればresolveが呼ばれる
      await testRequest("/api/health", {
        cookie: { otography_session: "some-session-cookie" },
      });

      // authSessionMiddlewareがスキップされていればresolveは呼ばれない
      expect(mockResolveSession).not.toHaveBeenCalled();
    });
  });

  describe("VAL-MW-001: 認証必須ルートはリファクタ後も正しく動作する", () => {
    it("POST /api/posts（cookieなし）→ 401", async () => {
      const res = await testRequest("/api/posts", {
        method: "POST",
        headers: { Origin: "http://localhost:3000" },
        body: { title: "test", content: "test" },
      });

      expect(res.status).toBe(401);
    });

    it("POST /api/posts/:id/like（cookieなし）→ 401", async () => {
      const res = await testRequest("/api/posts/550e8400-e29b-41d4-a716-446655440000/like", {
        method: "POST",
        headers: { Origin: "http://localhost:3000" },
      });

      expect(res.status).toBe(401);
    });

    it("GET /api/user（cookieなし）→ 401", async () => {
      const res = await testRequest("/api/user");

      expect(res.status).toBe(401);
    });

    it("POST /api/auth/sign-out（sessionなし）→ 204（処理継続）", async () => {
      const res = await testRequest("/api/auth/sign-out", {
        method: "POST",
        headers: { Origin: "http://localhost:3000" },
      });

      // sign-outはsessionがなくても処理を継続しcookieをクリアする
      expect(res.status).toBe(204);
    });
  });
});
