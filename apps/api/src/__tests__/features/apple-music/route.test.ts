import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeJwt } from "jose";
import { mockResolveSession } from "../../setup";
import { testRequest } from "../../helpers/test-client";

vi.mock("../../../shared/db", () => ({
  createDbClient: vi.fn(() => ({ db: {}, end: async () => undefined })),
}));

/*
 * テストリスト: GET /api/apple-music/token
 *
 * 3. Cookie なし → 401 (problem+json)
 * 4. 有効セッション → 200、developerToken をデコードすると origin と 1h exp
 * 5. Cache-Control: no-store（public / s-maxage がないことも確認）
 * 6. レートリミット — 11回目 → 429 / 未認証は 429 でなく 401
 */ describe("GET /api/apple-music/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("認証", () => {
    it("Cookie なし → 401 problem+json", async () => {
      const res = await testRequest("/api/apple-music/token");

      expect(res.status).toBe(401);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
      const body = await res.json();
      expect(body).toMatchObject({
        status: 401,
        title: "Unauthorized",
      });
    });

    it("有効セッション → 200、developerToken に origin と 1h TTL がある", async () => {
      mockResolveSession.mockResolvedValue({
        claims: { sub: "firebase-user-1", email: "test@example.com" },
        session: { id: "sess-1", userId: "uuid-1", version: 1 },
      });

      const res = await testRequest("/api/apple-music/token", {
        cookie: { otography_session: "a".repeat(43) },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const payload = decodeJwt(body.developerToken as string);

      expect(payload.origin).toEqual(["http://localhost:3000"]);
      expect(payload.exp! - payload.iat!).toBe(60 * 60);
    });
  });

  describe("キャッシュ制御", () => {
    it("Cache-Control: no-store（public / s-maxage なし）", async () => {
      mockResolveSession.mockResolvedValue({
        claims: { sub: "firebase-user-1", email: "test@example.com" },
        session: { id: "sess-1", userId: "uuid-1", version: 1 },
      });

      const res = await testRequest("/api/apple-music/token", {
        cookie: { otography_session: "a".repeat(43) },
      });

      expect(res.status).toBe(200);
      const cacheControl = res.headers.get("cache-control");
      expect(cacheControl).toBe("no-store");
      expect(cacheControl).not.toContain("public");
      expect(cacheControl).not.toContain("s-maxage");
    });
  });
});
