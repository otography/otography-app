import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeJwt } from "jose";
import { env } from "cloudflare:test";
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
 * 7. 401 応答にも Cache-Control: no-store が付与される
 * 8. 429 応答にも Cache-Control: no-store が付与される
 * 9. APP_FRONTEND_URL が空の場合 → 500 internal-error（fail-closed）
 */
describe("GET /api/apple-music/token", () => {
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

  describe("エラー応答のキャッシュ制御", () => {
    it("401 応答にも Cache-Control: no-store が付与される", async () => {
      const res = await testRequest("/api/apple-music/token");

      expect(res.status).toBe(401);
      expect(res.headers.get("cache-control")).toBe("no-store");
    });

    it("429 応答にも Cache-Control: no-store が付与される", async () => {
      mockResolveSession.mockResolvedValue({
        claims: { sub: "firebase-user-1", email: "test@example.com" },
        session: { id: "sess-1", userId: "uuid-1", version: 1 },
      });

      for (let i = 0; i < 10; i++) {
        await testRequest("/api/apple-music/token", {
          cookie: { otography_session: "a".repeat(43) },
        });
      }

      const res = await testRequest("/api/apple-music/token", {
        cookie: { otography_session: "a".repeat(43) },
      });

      expect(res.status).toBe(429);
      expect(res.headers.get("cache-control")).toBe("no-store");
    });
  });

  describe("空の APP_FRONTEND_URL（fail-closed）", () => {
    it("APP_FRONTEND_URL が空の場合 → 500 internal-error", async () => {
      mockResolveSession.mockResolvedValue({
        claims: { sub: "firebase-user-1", email: "test@example.com" },
        session: { id: "sess-1", userId: "uuid-1", version: 1 },
      });

      const { app } = await import("../../../index");
      const overriddenEnv = {
        ...env,
        APP_FRONTEND_URL: "",
        APPLE_MUSIC_TOKEN_RATE_LIMITER: {
          limit: async () => ({ success: true }),
        },
      };
      const res = await app.request(
        new URL("/api/apple-music/token", "http://localhost:3001"),
        {
          method: "GET",
          headers: [["Cookie", `otography_session=${"a".repeat(43)}`]],
        },
        overriddenEnv,
        {
          waitUntil: () => undefined,
          passThroughOnException: () => undefined,
          props: {},
        },
      );

      expect(res.status).toBe(500);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
      const body = await res.json();
      expect(body).toMatchObject({
        status: 500,
        type: "https://api.otography.com/errors/internal-error",
      });
    });

    it("500 の detail は安全な固定メッセージであり内部設定情報を漏洩しない", async () => {
      mockResolveSession.mockResolvedValue({
        claims: { sub: "firebase-user-1", email: "test@example.com" },
        session: { id: "sess-1", userId: "uuid-1", version: 1 },
      });

      const { app } = await import("../../../index");
      const overriddenEnv = {
        ...env,
        APP_FRONTEND_URL: "",
        APPLE_MUSIC_TOKEN_RATE_LIMITER: {
          limit: async () => ({ success: true }),
        },
      };
      const res = await app.request(
        new URL("/api/apple-music/token", "http://localhost:3001"),
        {
          method: "GET",
          headers: [["Cookie", `otography_session=${"a".repeat(43)}`]],
        },
        overriddenEnv,
        {
          waitUntil: () => undefined,
          passThroughOnException: () => undefined,
          props: {},
        },
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      // detail は安定した非技術的メッセージで固定値
      expect(body).toMatchObject({
        detail: "Apple Music developer token could not be issued. Please try again later.",
      });
      // 内部設定情報が漏洩しないこと
      const serializedBody = JSON.stringify(body);
      expect(serializedBody).not.toContain("APP_FRONTEND_URL");
      expect(serializedBody).not.toContain("environment variable");
      expect(serializedBody).not.toContain("not configured");
      expect(serializedBody).not.toContain("configuration");
    });
  });
});
