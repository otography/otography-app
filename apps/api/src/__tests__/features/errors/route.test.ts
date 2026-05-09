/**
 * テストリスト: GET /errors/:type ドキュメントエンドポイント
 *
 * 1. 既知の slug で GET /errors/artist-already-exists → 200, Content-Type: text/html,
 *    body に title と description を含む (VAL-EPT-001)
 * 2. 未知の slug で GET /errors/nonexistent-error → 404 (VAL-EPT-002)
 * 3. Accept: application/json で GET /errors/artist-already-exists → 200,
 *    Content-Type: application/json, JSON に { type, title, status, description } を含む (VAL-EPT-003)
 * 4. ルートが app に .route('/errors', errors) として登録されている —
 *    app.request('/errors/artist-already-exists') が 200 を返す (VAL-EPT-004)
 * 5. 複数の既知 slug（session-expired, rate-limit-exceeded 等）で 200 を返す
 * 6. 汎用 slug（bad-request 等）も type URI のドキュメントとして 200 を返す
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

  describe("Accept: application/json（JSON レスポンス）", () => {
    it("JSON レスポンスに { type, title, status, description } を含む", async () => {
      const res = await testRequest("/errors/artist-already-exists", {
        headers: { Accept: "application/json" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/json");

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

  describe("汎用 Problem Details slug", () => {
    it("GET /errors/bad-request → 200, text/html, body に title と description を含む", async () => {
      const res = await testRequest("/errors/bad-request");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/html");

      const body = await res.text();
      expect(body).toContain("Bad Request");
      expect(body).toContain("リクエストの形式または内容が不正です");
    });

    it("Accept: application/json で汎用 slug の説明を返す", async () => {
      const res = await testRequest("/errors/unauthorized", {
        headers: { Accept: "application/json" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/json");

      const body = await res.json();
      expect(body).toMatchObject({
        type: "https://api.otography.com/errors/unauthorized",
        title: "Unauthorized",
        status: 401,
        description: "認証が必要です。ログインしてから再試行してください。",
      });
    });
  });
});
