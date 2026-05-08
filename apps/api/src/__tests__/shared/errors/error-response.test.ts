/**
 * テストリスト: formatErrorResponse (RFC 7807 Problem Details)
 *
 * DbError:
 * 1. DbError(409) → ProblemDetails{type: '...conflict', title: 'Conflict', status: 409, detail: error.message}
 * 2. DbError(400) → ProblemDetails{type: '...bad-request', title: 'Bad Request', status: 400, detail: error.message}
 *
 * AuthError:
 * 3. AuthError(401, clearCookie:true) → body + clearCookie: true
 * 4. AuthError(401, clearCookie:false) → clearCookie なし
 *
 * RlsError:
 * 5. RlsError → ProblemDetails{detail: 'Internal server error.'}（元メッセージ非公開）
 *
 * HTTPException:
 * 6. HTTPException(404) → 正しい RFC 7807 形式
 *
 * unknown:
 * 7. unknown Error → ProblemDetails{detail: 'Internal server error.'}（スタックトレースなし）
 * 8. 非 Error 値（文字列） → ProblemDetails{detail: 'Internal server error.'}
 *
 * マッピングテーブル:
 * 9. 全8ステータスコードの type/title マッピングが正しい
 */
import { describe, expect, it } from "vitest";
import { HTTPException } from "hono/http-exception";
import { DbError, RlsError } from "@repo/errors";
import { AuthError } from "@repo/errors/server";
import { formatErrorResponse } from "../../../shared/errors/error-response";

describe("formatErrorResponse", () => {
  describe("DbError", () => {
    it("DbError(409) を正しい RFC 7807 形式に変換する", () => {
      const error = new DbError({ message: "Artist already exists.", statusCode: 409 });
      const result = formatErrorResponse(error);

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/conflict",
          title: "Conflict",
          status: 409,
          detail: "Artist already exists.",
        },
        statusCode: 409,
      });
      expect(result).not.toHaveProperty("clearCookie");
    });

    it("DbError(400) を正しい RFC 7807 形式に変換する", () => {
      const error = new DbError({ message: "Missing field.", statusCode: 400 });
      const result = formatErrorResponse(error);

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/bad-request",
          title: "Bad Request",
          status: 400,
          detail: "Missing field.",
        },
        statusCode: 400,
      });
    });
  });

  describe("AuthError", () => {
    it("AuthError(401, clearCookie:true) の場合、clearCookie: true を含む", () => {
      const error = new AuthError({
        message: "Session expired.",
        code: "auth/session-cookie-expired",
        statusCode: 401,
        clearCookie: true,
      });
      const result = formatErrorResponse(error);

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/unauthorized",
          title: "Unauthorized",
          status: 401,
          detail: "Session expired.",
        },
        statusCode: 401,
        clearCookie: true,
      });
    });

    it("AuthError(401, clearCookie:false) の場合、clearCookie を含まない", () => {
      const error = new AuthError({
        message: "Invalid credentials.",
        code: "auth/invalid-credentials",
        statusCode: 401,
        clearCookie: false,
      });
      const result = formatErrorResponse(error);

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/unauthorized",
          title: "Unauthorized",
          status: 401,
          detail: "Invalid credentials.",
        },
        statusCode: 401,
      });
      expect(result).not.toHaveProperty("clearCookie");
    });
  });

  describe("RlsError", () => {
    it("RlsError の detail を 'Internal server error.' に固定し、元メッセージを隠す", () => {
      const error = new RlsError({ message: "RLS policy violation: user XYZ tried..." });
      const result = formatErrorResponse(error);

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/internal-error",
          title: "Internal Server Error",
          status: 500,
          detail: "Internal server error.",
        },
        statusCode: 500,
      });
      expect(result.body.detail).not.toContain("XYZ");
      expect(result.body.detail).not.toContain("RLS");
    });
  });

  describe("HTTPException", () => {
    it("HTTPException(404) を正しい RFC 7807 形式に変換する", () => {
      const error = new HTTPException(404, { message: "Not Found" });
      const result = formatErrorResponse(error);

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/not-found",
          title: "Not Found",
          status: 404,
          detail: "Not Found",
        },
        statusCode: 404,
      });
    });
  });

  describe("unknown", () => {
    it("プレーン Error の detail を 'Internal server error.' に固定する", () => {
      const error = new Error("Database connection failed: password=secret");
      const result = formatErrorResponse(error);

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/internal-error",
          title: "Internal Server Error",
          status: 500,
          detail: "Internal server error.",
        },
        statusCode: 500,
      });
      expect(result.body.detail).not.toContain("secret");
      expect(result.body.detail).not.toContain("password");
    });

    it("非 Error 値（文字列）の detail を 'Internal server error.' に固定する", () => {
      const result = formatErrorResponse("something went wrong");

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/internal-error",
          title: "Internal Server Error",
          status: 500,
          detail: "Internal server error.",
        },
        statusCode: 500,
      });
    });
  });

  describe("ステータスコードマッピング", () => {
    it.each([
      [400, "bad-request", "Bad Request"],
      [401, "unauthorized", "Unauthorized"],
      [403, "forbidden", "Forbidden"],
      [404, "not-found", "Not Found"],
      [409, "conflict", "Conflict"],
      [500, "internal-error", "Internal Server Error"],
      [502, "bad-gateway", "Bad Gateway"],
      [503, "service-unavailable", "Service Unavailable"],
    ] as const)("ステータスコード %i → type: '.../%s', title: '%s'", (status, errorType, title) => {
      const error = new DbError({ message: "test", statusCode: status });
      const result = formatErrorResponse(error);

      expect(result.body.type).toBe(`https://api.otography.com/errors/${errorType}`);
      expect(result.body.title).toBe(title);
      expect(result.body.status).toBe(status);
      expect(result.statusCode).toBe(status);
    });
  });
});
