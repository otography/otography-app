/**
 * テストリスト: グローバルエラーハンドラー (.onError) + .notFound()
 *
 * Content-Type:
 * 1. 全エラーで Content-Type: application/problem+json が返る
 *
 * DbError:
 * 2. DbError が RFC 9457 形式で返る（type, title, status, detail が正しい）
 *
 * AuthError (clearCookie):
 * 3. AuthError(clearCookie:true) で Set-Cookie ヘッダーが otography_session をクリア
 * 4. AuthError(clearCookie:false) で Set-Cookie なし
 *
 * RlsError:
 * 5. RlsError で detail が 'Internal server error.'（元メッセージ非公開）
 *
 * unknown Error:
 * 6. unknown Error で detail が 'Internal server error.'（スタックトレース非公開）
 *
 * logError 呼び出し:
 * 7. logError が呼ばれる（構造化ログが出力される）
 *
 * .notFound():
 * 8. .notFound() が RFC 9457 404 を返す
 */
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { DbError, RlsError } from "@repo/errors";
import { AuthError } from "@repo/errors/server";
import {
  createProblemInstance,
  formatErrorResponse,
  problemResponse,
} from "../shared/errors/error-response";
import { logError } from "../shared/logging/structured-log";
// テスト用に固定のCookie名（開発環境と同じ）
const SESSION_COOKIE_NAME = "otography_session";
import { deleteCookie } from "hono/cookie";

// グローバルエラーハンドラーを適用したテスト用アプリを構築
const createTestApp = () => {
  const app = new Hono();

  // テスト用ルート: 各種エラーをスロー
  app.get("/test/db-error", () => {
    throw new DbError({ message: "Artist already exists.", statusCode: 409 });
  });

  app.get("/test/auth-clear-cookie", () => {
    throw new AuthError({
      message: "Session expired.",
      code: "auth/session-cookie-expired",
      statusCode: 401,
      clearCookie: true,
    });
  });

  app.get("/test/auth-no-clear-cookie", () => {
    throw new AuthError({
      message: "Invalid credentials.",
      code: "auth/invalid-credentials",
      statusCode: 401,
      clearCookie: false,
    });
  });

  app.get("/test/rls-error", () => {
    throw new RlsError({ message: "RLS policy violation: user XYZ tried..." });
  });

  app.get("/test/unknown-error", () => {
    throw new Error("Database connection failed: password=secret");
  });

  // onError: formatErrorResponse + logError
  app.onError((err, c) => {
    logError(err, c.req.path);
    const { body, statusCode, clearCookie } = formatErrorResponse(err, {
      instance: createProblemInstance(),
    });

    if (clearCookie) {
      deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
    }

    return c.body(JSON.stringify(body), statusCode, {
      "Content-Type": "application/problem+json",
    });
  });

  // notFound: registry 経由で RFC 9457 404 を返す
  app.notFound((c) => {
    return problemResponse(c, "not-found", "Not found.");
  });

  return app;
};

describe("グローバルエラーハンドラー", () => {
  describe("Content-Type", () => {
    it("全エラーで Content-Type: application/problem+json が返る", async () => {
      const app = createTestApp();

      const res = await app.request("/test/db-error");

      expect(res.status).toBe(409);
      expect(res.headers.get("content-type")).toBe("application/problem+json");
    });
  });

  describe("DbError", () => {
    it("DbError が RFC 9457 形式で返る", async () => {
      const app = createTestApp();

      const res = await app.request("/test/db-error");
      const body = (await res.json()) as Record<string, unknown>;

      expect(res.status).toBe(409);
      expect(body).toMatchObject({
        type: "https://api.otography.com/errors/conflict",
        title: "Conflict",
        status: 409,
        detail: "Artist already exists.",
      });
    });

    it("ProblemDetails に発生単位の instance を含める", async () => {
      const app = createTestApp();

      const res = await app.request("/test/db-error");
      const body = (await res.json()) as Record<string, unknown>;

      expect(body.instance).toMatch(/^urn:otography:problem:[0-9a-f-]{36}$/);
    });
  });

  describe("AuthError clearCookie", () => {
    it("AuthError(clearCookie:true) で Set-Cookie ヘッダーが otography_session をクリア", async () => {
      const app = createTestApp();

      const res = await app.request("/test/auth-clear-cookie");

      expect(res.status).toBe(401);
      const setCookie = res.headers.getSetCookie();
      const sessionCookie = setCookie.find((c: string) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      // クリアされた Cookie は値が空または maxAge=0
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toMatch(/otography_session=;/);
    });

    it("AuthError(clearCookie:false) で Set-Cookie なし", async () => {
      const app = createTestApp();

      const res = await app.request("/test/auth-no-clear-cookie");

      expect(res.status).toBe(401);
      const setCookie = res.headers.getSetCookie();
      const sessionCookie = setCookie.find((c: string) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      expect(sessionCookie).toBeUndefined();
    });
  });

  describe("RlsError", () => {
    it("RlsError で detail が 'Internal server error.'", async () => {
      const app = createTestApp();

      const res = await app.request("/test/rls-error");
      const body = (await res.json()) as Record<string, unknown>;

      expect(res.status).toBe(500);
      expect(body).toMatchObject({
        type: "https://api.otography.com/errors/internal-error",
        title: "Internal Server Error",
        status: 500,
        detail: "Internal server error.",
      });
      expect(body.detail).not.toContain("XYZ");
      expect(body.detail).not.toContain("RLS");
    });
  });

  describe("unknown Error", () => {
    it("unknown Error で detail が 'Internal server error.'", async () => {
      const app = createTestApp();

      const res = await app.request("/test/unknown-error");
      const body = (await res.json()) as Record<string, unknown>;

      expect(res.status).toBe(500);
      expect(body).toMatchObject({
        type: "https://api.otography.com/errors/internal-error",
        title: "Internal Server Error",
        status: 500,
        detail: "Internal server error.",
      });
      expect(body.detail).not.toContain("secret");
      expect(body.detail).not.toContain("password");
    });
  });

  describe("logError", () => {
    it("logError が呼ばれる", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const app = createTestApp();

      await app.request("/test/db-error");

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = consoleSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("timestamp");
      expect(parsed).toHaveProperty("path", "/test/db-error");

      consoleSpy.mockRestore();
    });
  });

  describe(".notFound()", () => {
    it(".notFound() が RFC 9457 404 を返す", async () => {
      const app = createTestApp();

      const res = await app.request("/api/nonexistent");
      const body = (await res.json()) as Record<string, unknown>;

      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toBe("application/problem+json");
      expect(body).toMatchObject({
        type: "https://api.otography.com/errors/not-found",
        title: "Not Found",
        status: 404,
        detail: "Not found.",
      });
      expect(body.instance).toMatch(/^urn:otography:problem:[0-9a-f-]{36}$/);
    });
  });
});
