/**
 * テストリスト: formatErrorResponse (RFC 9457 Problem Details)
 *
 * AuthError.fromFirebase() problemSlug マッピング (VAL-AUTH-002〜007):
 * F1. auth/session-cookie-expired → formatErrorResponse type: .../session-expired
 * F2. auth/session-cookie-revoked → formatErrorResponse type: .../session-revoked
 * F3. auth/user-disabled → formatErrorResponse type: .../account-disabled
 * F4. auth/argument-error → formatErrorResponse type: .../session-invalid
 * F5. auth/invalid-id-token → formatErrorResponse type: .../session-invalid
 * F6. auth/invalid-session-cookie-duration → formatErrorResponse type: .../session-invalid
 * F7. auth/user-not-found → formatErrorResponse type: .../session-invalid
 * F8. auth/internal-error → formatErrorResponse type: .../auth-service-unavailable
 * F9. 未知の Firebase エラーコード → problemSlug: undefined（STATUS_MAPPING フォールバック）
 *
 * DbError:
 * 1. DbError(409) → ProblemDetails{type: '...conflict', title: 'Conflict', status: 409, detail: error.message}
 * 2. DbError(400) → ProblemDetails{type: '...bad-request', title: 'Bad Request', status: 400, detail: error.message}
 * 3. DbError(409, problemSlug) → body.type = problemSlug URI（ドメイン固有 URI）
 *
 * AuthError:
 * 4. AuthError(401, clearCookie:true) → body + clearCookie: true
 * 5. AuthError(401, clearCookie:false) → clearCookie なし
 * 6. AuthError(401, problemSlug, clearCookie:true) → body.type = problemSlug URI + clearCookie: true
 *
 * AuthRestError:
 * 7. AuthRestError(401, problemSlug) → body.type = problemSlug URI
 *
 * OAuth 系エラー:
 * 8. OAuthExchangeError(problemSlug) → body.type = problemSlug URI
 * 9. GoogleTokenExchangeError(problemSlug) → body.type = problemSlug URI
 * 10. FirebaseIdpSigninError(problemSlug) → body.type = problemSlug URI
 * 11. AccountConflictError(problemSlug) → body.type = problemSlug URI
 *
 * RlsError:
 * 12. RlsError → ProblemDetails{detail: 'Internal server error.'}（元メッセージ非公開）
 *
 * HTTPException:
 * 13. HTTPException(404) → 正しい RFC 9457 形式
 *
 * unknown:
 * 14. unknown Error → ProblemDetails{detail: 'Internal server error.'}（スタックトレースなし）
 * 15. 非 Error 値（文字列） → ProblemDetails{detail: 'Internal server error.'}
 *
 * セキュリティ（problemSlug 無視）:
 * 16. RlsError() → 常に internal-error（セキュリティ上 problemSlug を無視）
 * 17. unknown Error(problemSlug-like) → 常に internal-error（セキュリティ上 problemSlug を無視）
 * 18. registry 外 problemSlug を採用せず statusCode の汎用 problem type にフォールバック
 *
 * マッピングテーブル:
 * 19. 全8ステータスコードの type/title マッピングが正しい
 */
import { describe, expect, it } from "vitest";
import { HTTPException } from "hono/http-exception";
import { FirebaseAuthError } from "@repo/firebase-auth-rest/auth";
import {
  DbError,
  RlsError,
  AuthRestError,
  OAuthExchangeError,
  GoogleTokenExchangeError,
  FirebaseIdpSigninError,
  AccountConflictError,
} from "@repo/errors";
import { AuthError } from "@repo/errors/server";
import { formatErrorResponse } from "../../../shared/errors/error-response";

describe("formatErrorResponse", () => {
  describe("DbError", () => {
    it("instance を指定すると ProblemDetails に含める", () => {
      const error = new DbError({ message: "Artist already exists.", statusCode: 409 });
      const result = formatErrorResponse(error, {
        instance: "urn:otography:problem:test-instance",
      });

      expect(result.body.instance).toBe("urn:otography:problem:test-instance");
    });

    it("DbError(409) を正しい RFC 9457 形式に変換する", () => {
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

    it("DbError(400) を正しい RFC 9457 形式に変換する", () => {
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
    it("HTTPException(404) を正しい RFC 9457 形式に変換する", () => {
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

  describe("problemSlug あり: DbError", () => {
    it("DbError(409, problemSlug) の body.type に problemSlug を使用する (VAL-ERR-001)", () => {
      const error = new DbError({
        message: "Artist already exists.",
        statusCode: 409,
        problemSlug: "artist-already-exists",
      });
      const result = formatErrorResponse(error);

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/artist-already-exists",
          title: "Artist Already Exists",
          status: 409,
          detail: "Artist already exists.",
        },
        statusCode: 409,
      });
    });

    it("problemSlug がある場合は registry の statusCode を HTTP status と body.status に使う", () => {
      const error = new DbError({
        message: "Artist already exists.",
        statusCode: 500,
        problemSlug: "artist-already-exists",
      });
      const result = formatErrorResponse(error);

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/artist-already-exists",
          title: "Artist Already Exists",
          status: 409,
          detail: "Artist already exists.",
        },
        statusCode: 409,
      });
    });
  });

  describe("problemSlug なし: DbError フォールバック (VAL-ERR-002)", () => {
    it("DbError(409) problemSlug なし → STATUS_MAPPING の problemSlug を使用する", () => {
      const error = new DbError({ message: "Artist already exists.", statusCode: 409 });
      const result = formatErrorResponse(error);

      expect(result.body.type).toBe("https://api.otography.com/errors/conflict");
    });
  });

  describe("problemSlug あり: AuthError (VAL-ERR-003)", () => {
    it("AuthError(401, problemSlug, clearCookie:true) → body.type = problemSlug URI, clearCookie: true", () => {
      const error = new AuthError({
        message: "Session expired.",
        code: "auth/session-cookie-expired",
        statusCode: 401,
        clearCookie: true,
        problemSlug: "session-expired",
      });
      const result = formatErrorResponse(error);

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/session-expired",
          title: "Session Expired",
          status: 401,
          detail: "Session expired.",
        },
        statusCode: 401,
        clearCookie: true,
      });
    });
  });

  describe("problemSlug あり: AuthRestError (VAL-ERR-004)", () => {
    it("problemSlug なしでは statusCode の汎用 problem type にフォールバックする", () => {
      const error = new AuthRestError({
        message: "Invalid email or password.",
        statusCode: 401,
      });
      const result = formatErrorResponse(error);

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/unauthorized",
          title: "Unauthorized",
          status: 401,
          detail: "Invalid email or password.",
        },
        statusCode: 401,
      });
    });
  });

  describe("problemSlug あり: OAuth 系エラー", () => {
    it("OAuthExchangeError(problemSlug) → body.type = problemSlug URI", () => {
      const error = new OAuthExchangeError({
        message: "OAuth provider unreachable.",
        problemSlug: "oauth-exchange-failed",
      });
      const result = formatErrorResponse(error);

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/oauth-exchange-failed",
          title: "OAuth Exchange Failed",
          status: 502,
          detail: "OAuth provider unreachable.",
        },
        statusCode: 502,
      });
    });

    it("GoogleTokenExchangeError(problemSlug) → body.type = problemSlug URI", () => {
      const error = new GoogleTokenExchangeError({
        message: "Google token exchange failed.",
        problemSlug: "google-token-exchange-failed",
      });
      const result = formatErrorResponse(error);

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/google-token-exchange-failed",
          title: "Google Token Exchange Failed",
          status: 502,
          detail: "Google token exchange failed.",
        },
        statusCode: 502,
      });
    });

    it("FirebaseIdpSigninError(problemSlug) → body.type = problemSlug URI", () => {
      const error = new FirebaseIdpSigninError({
        message: "Firebase IDP sign-in failed.",
        problemSlug: "firebase-idp-signin-failed",
      });
      const result = formatErrorResponse(error);

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/firebase-idp-signin-failed",
          title: "Firebase IDP Sign-In Failed",
          status: 502,
          detail: "Firebase IDP sign-in failed.",
        },
        statusCode: 502,
      });
    });

    it("AccountConflictError(problemSlug) → body.type = problemSlug URI", () => {
      const error = new AccountConflictError({
        message: "Account conflict.",
        problemSlug: "account-conflict",
      });
      const result = formatErrorResponse(error);

      expect(result).toMatchObject({
        body: {
          type: "https://api.otography.com/errors/account-conflict",
          title: "Account Conflict",
          status: 409,
          detail: "Account conflict.",
        },
        statusCode: 409,
      });
    });
  });

  describe("セキュリティ: problemSlug を持つエラーの internal-error マッピング", () => {
    it("unknown Error の problemSlug-like プロパティは無視して internal-error にマッピング", () => {
      const error = Object.assign(new Error("RLS violation"), {
        problemSlug: "post-not-found",
      });
      const result = formatErrorResponse(error);

      expect(result.body.type).toBe("https://api.otography.com/errors/internal-error");
      expect(result.body.detail).toBe("Internal server error.");
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

describe("AuthError.fromFirebase() problemSlug マッピング (VAL-AUTH-002〜007)", () => {
  it("auth/session-cookie-expired → type: .../session-expired (VAL-AUTH-002)", () => {
    const firebaseError = new FirebaseAuthError({
      code: "session-cookie-expired",
      message: "SESSION_COOKIE_EXPIRED",
    });
    const authError = AuthError.fromFirebase(firebaseError, "Session verification failed.");
    const result = formatErrorResponse(authError);

    expect(result.body.type).toBe("https://api.otography.com/errors/session-expired");
    expect(result.body.status).toBe(401);
    expect(result.body.detail).toBe("Session expired.");
    expect(result.clearCookie).toBe(true);
  });

  it("auth/session-cookie-revoked → type: .../session-revoked (VAL-AUTH-003)", () => {
    const firebaseError = new FirebaseAuthError({
      code: "session-cookie-revoked",
      message: "SESSION_COOKIE_REVOKED",
    });
    const authError = AuthError.fromFirebase(firebaseError, "Session verification failed.");
    const result = formatErrorResponse(authError);

    expect(result.body.type).toBe("https://api.otography.com/errors/session-revoked");
    expect(result.body.status).toBe(401);
    expect(result.body.detail).toBe("Session revoked.");
    expect(result.clearCookie).toBe(true);
  });

  it("auth/user-disabled → type: .../account-disabled (VAL-AUTH-004)", () => {
    const firebaseError = new FirebaseAuthError({
      code: "user-disabled",
      message: "USER_DISABLED",
    });
    const authError = AuthError.fromFirebase(firebaseError, "Session verification failed.");
    const result = formatErrorResponse(authError);

    expect(result.body.type).toBe("https://api.otography.com/errors/account-disabled");
    expect(result.body.status).toBe(403);
    expect(result.body.detail).toBe("Account is disabled.");
    expect(result.clearCookie).toBe(true);
  });

  it("auth/argument-error → type: .../session-invalid", () => {
    const firebaseError = new FirebaseAuthError({
      code: "argument-error",
      message: "INVALID_ARGUMENT",
    });
    const authError = AuthError.fromFirebase(firebaseError, "Session verification failed.");
    const result = formatErrorResponse(authError);

    expect(result.body.type).toBe("https://api.otography.com/errors/session-invalid");
    expect(result.body.status).toBe(401);
    expect(result.clearCookie).toBe(true);
  });

  it("auth/invalid-id-token → type: .../session-invalid", () => {
    const firebaseError = new FirebaseAuthError({
      code: "invalid-id-token",
      message: "INVALID_ID_TOKEN",
    });
    const authError = AuthError.fromFirebase(firebaseError, "Session verification failed.");
    const result = formatErrorResponse(authError);

    expect(result.body.type).toBe("https://api.otography.com/errors/session-invalid");
    expect(result.body.status).toBe(401);
    expect(result.clearCookie).toBe(true);
  });

  it("auth/invalid-session-cookie-duration → type: .../session-invalid", () => {
    const firebaseError = new FirebaseAuthError({
      code: "invalid-session-cookie-duration",
      message: "INVALID_DURATION",
    });
    const authError = AuthError.fromFirebase(firebaseError, "Session verification failed.");
    const result = formatErrorResponse(authError);

    expect(result.body.type).toBe("https://api.otography.com/errors/session-invalid");
    expect(result.body.status).toBe(401);
    expect(result.statusCode).toBe(401);
  });

  it("auth/user-not-found → type: .../session-invalid", () => {
    const firebaseError = new FirebaseAuthError({
      code: "user-not-found",
      message: "USER_NOT_FOUND",
    });
    const authError = AuthError.fromFirebase(firebaseError, "Session verification failed.");
    const result = formatErrorResponse(authError);

    expect(result.body.type).toBe("https://api.otography.com/errors/session-invalid");
    expect(result.body.status).toBe(401);
    expect(result.clearCookie).toBe(true);
  });

  it("auth/internal-error → type: .../auth-service-unavailable (VAL-AUTH-007)", () => {
    const firebaseError = new FirebaseAuthError({
      code: "internal-error",
      message: "INTERNAL_ERROR",
    });
    const authError = AuthError.fromFirebase(firebaseError, "Session verification failed.");
    const result = formatErrorResponse(authError);

    expect(result.body.type).toBe("https://api.otography.com/errors/auth-service-unavailable");
    expect(result.body.status).toBe(503);
    expect(result.body.detail).toBe("Authentication service unavailable.");
  });

  it("未知の Firebase エラーコード → problemSlug なし（STATUS_MAPPING フォールバック）", () => {
    const firebaseError = new FirebaseAuthError({
      code: "some-unknown-code",
      message: "SOMETHING_UNKNOWN",
    });
    const authError = AuthError.fromFirebase(firebaseError, "Session verification failed.");
    const result = formatErrorResponse(authError);

    expect(result.body.type).toBe("https://api.otography.com/errors/unauthorized");
    expect(result.body.status).toBe(401);
    expect(result.body.detail).toBe("Session verification failed.");
  });
});
