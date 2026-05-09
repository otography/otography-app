/**
 * テストリスト: GET /errors/:type ドキュメントエンドポイント
 *
 * 1. 既知の slug で GET /errors/artist-already-exists → 200, Content-Type: text/html,
 *    body に title と description を含む (VAL-EPT-001)
 * 2. 未知の slug で GET /errors/nonexistent-error → 404 (VAL-EPT-002)
 * 3. Accept: application/problem+json で GET /errors/artist-already-exists → 200,
 *    Content-Type: application/problem+json, JSON に { type, title, status, description } を含む (VAL-EPT-003)
 * 4. ルートが app に .route('/errors', errors) として登録されている —
 *    app.request('/errors/artist-already-exists') が 200 を返す (VAL-EPT-004)
 * 5. 複数の既知 slug（session-expired, rate-limit-exceeded 等）で 200 を返す
 */

import { describe, expect, it } from "vitest";
import { testRequest } from "../../helpers/test-client";

describe("GET /errors/:type ドキュメントエンドポイント", () => {
  describe("既知の slug（HTML レスポンス）", () => {
    it("GET /errors/artist-already-exists → 200, text/html, body に title と description を含む", async () => {
      const res = await testRequest("/errors/artist-already-exists");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/html");

      const body = await res.text();
      // title と description が HTML に含まれている
      expect(body).toContain("Artist Already Exists");
      expect(body).toContain("指定されたアーティストは既に登録されています");
    });
  });

  describe("未知の slug", () => {
    it("GET /errors/nonexistent-error → 404", async () => {
      const res = await testRequest("/errors/nonexistent-error");

      expect(res.status).toBe(404);
    });
  });

  describe("Accept: application/problem+json（JSON レスポンス）", () => {
    it("JSON レスポンスに { type, title, status, description } を含む", async () => {
      const res = await testRequest("/errors/artist-already-exists", {
        headers: { Accept: "application/problem+json" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/problem+json");

      const body = await res.json();
      expect(body).toMatchObject({
        type: "https://api.otography.com/errors/artist-already-exists",
        title: "Artist Already Exists",
        status: 409,
        description: "指定されたアーティストは既に登録されています。",
      });
    });
  });

  describe("ルート登録の確認（VAL-EPT-004）", () => {
    it("app に /errors ルートが登録されており、既知 slug で 200 を返す", async () => {
      const res = await testRequest("/errors/artist-already-exists");

      expect(res.status).toBe(200);
    });
  });

  describe("複数の既知 slug で 200 を返す", () => {
    it.each([
      "session-expired",
      "rate-limit-exceeded",
      "account-disabled",
      "post-not-found",
      "auth-service-unavailable",
    ] as const)("%s → 200", async (slug) => {
      const res = await testRequest(`/errors/${slug}`);

      expect(res.status).toBe(200);
    });
  });
});
