/**
 * テストリスト: firebase-admin ラッパーの checkRevoked 引数分離（MUS-27）
 *
 * - verifySessionCookie は下位ライブラリを (cookie, false) で呼ぶ（オフライン検証）
 * - verifySessionCookieStrict は (cookie, true) で呼ぶ（失効・無効化チェック）
 * - verifySessionCookieStrict は Firebase エラーを AuthError として値で返す（throw しない）
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../setup";
import { mockVerifySessionCookie } from "../../setup";
import { AuthError } from "@repo/errors/server";
import { FirebaseAuthError } from "@repo/firebase-auth-rest/auth";

describe("firebase-admin ラッパーの checkRevoked 引数分離（MUS-27）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifySessionCookie は下位ライブラリを (cookie, false) で呼ぶ", async () => {
    const expectedClaims = { sub: "user123", email: "test@example.com" };
    mockVerifySessionCookie.mockResolvedValue(expectedClaims);

    // firebase-admin モジュールのモックをバイパスして実装を取り出す。
    // 依存（@repo/firebase-auth-rest/auth の getAuth）は setup.ts でモック済み。
    const actual = await vi.importActual<typeof import("../../../shared/firebase/firebase-admin")>(
      "../../../shared/firebase/firebase-admin",
    );

    const claims = await actual.verifySessionCookie("session-cookie-value");

    expect(claims).toEqual(expectedClaims);
    // checkRevoked=false で呼ばれることで、Firebase への getUser 往復を回避する
    expect(mockVerifySessionCookie).toHaveBeenCalledWith("session-cookie-value", false);
  });

  it("verifySessionCookieStrict は下位ライブラリを (cookie, true) で呼ぶ", async () => {
    const expectedClaims = { sub: "user123", email: "test@example.com" };
    mockVerifySessionCookie.mockResolvedValue(expectedClaims);

    const actual = await vi.importActual<typeof import("../../../shared/firebase/firebase-admin")>(
      "../../../shared/firebase/firebase-admin",
    );

    const claims = await actual.verifySessionCookieStrict("session-cookie-value");

    expect(claims).toEqual(expectedClaims);
    // checkRevoked=true で呼ばれることで、失効・無効化を Firebase に確認する
    expect(mockVerifySessionCookie).toHaveBeenCalledWith("session-cookie-value", true);
  });

  it("verifySessionCookieStrict は Firebase エラーを AuthError として値で返す", async () => {
    const firebaseError = new FirebaseAuthError({
      code: "session-cookie-revoked",
      message: "The session cookie has been revoked.",
    });
    mockVerifySessionCookie.mockRejectedValue(firebaseError);

    const actual = await vi.importActual<typeof import("../../../shared/firebase/firebase-admin")>(
      "../../../shared/firebase/firebase-admin",
    );

    const result = await actual.verifySessionCookieStrict("session-cookie-value");

    // errore スタイル: throw せず AuthError を値として返す
    expect(result).toBeInstanceOf(AuthError);
    expect(result).toBeInstanceOf(Error);
    if (result instanceof AuthError) {
      expect(result.code).toBe("auth/session-cookie-revoked");
    }
  });
});
