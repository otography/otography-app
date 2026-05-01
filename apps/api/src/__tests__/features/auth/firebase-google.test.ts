import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeGoogleCode, signInWithGoogleIdp } from "../../../shared/firebase/firebase-google";

// fetchをモック — Google・Firebaseへの外部API呼び出しを境界でモック
const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;
vi.stubGlobal("fetch", mockFetch);

// 他のテストファイルにモックがリークしないよう、全テスト終了後にオリジナルを復元
afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe("exchangeGoogleCode", () => {
  const validParams = {
    clientId: "test-client-id.apps.googleusercontent.com",
    clientSecret: "test-client-secret",
    code: "test-auth-code",
    redirectUri: "http://localhost:3001/api/auth/google/callback",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("成功時に { id_token, access_token } を返す", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id_token: "google-id-token-123",
          access_token: "google-access-token-456",
          token_type: "Bearer",
          expires_in: 3599,
          refresh_token: "google-refresh-token",
          scope: "openid email profile",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await exchangeGoogleCode(validParams);

    expect(result).not.toBeInstanceOf(Error);
    expect(result).toMatchObject({
      id_token: "google-id-token-123",
      access_token: "google-access-token-456",
    });
  });

  it("Googleに正しいリクエストを送信する", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id_token: "t", access_token: "a" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await exchangeGoogleCode(validParams);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0]!;

    // URLの検証
    expect(url.toString()).toBe("https://oauth2.googleapis.com/token");
    // リクエストメソッドとヘッダー
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({ "Content-Type": "application/x-www-form-urlencoded" });

    // リクエストボディの検証（URLSearchParams形式）
    const body = new URLSearchParams(options.body as string);
    expect(body.get("client_id")).toBe(validParams.clientId);
    expect(body.get("client_secret")).toBe(validParams.clientSecret);
    expect(body.get("code")).toBe(validParams.code);
    expect(body.get("redirect_uri")).toBe(validParams.redirectUri);
    expect(body.get("grant_type")).toBe("authorization_code");
  });

  it("Googleがエラーを返した場合にGoogleTokenExchangeErrorを返す", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "Bad Request",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await exchangeGoogleCode(validParams);

    expect(result).toBeInstanceOf(Error);
    // GoogleTokenExchangeErrorの検証
    if (result instanceof Error) {
      expect(result.message).toBeTruthy();
    }
  });

  it("ネットワークエラー時にGoogleTokenExchangeErrorを返す", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const result = await exchangeGoogleCode(validParams);

    expect(result).toBeInstanceOf(Error);
  });

  it("JSON parse失敗をcauseに保持してGoogleTokenExchangeErrorを返す", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("not-json", { status: 400, headers: { "Content-Type": "application/json" } }),
    );

    const result = await exchangeGoogleCode(validParams);

    expect(result).toBeInstanceOf(Error);
    if (result instanceof Error) {
      expect((result as unknown as { _tag: string })._tag).toBe("GoogleTokenExchangeError");
      expect(result.message).toBe("Google token exchange failed.");
      expect((result.cause as { _tag?: string } | undefined)?._tag).toBe(
        "GoogleTokenExchangeError",
      );
      expect((result.cause as Error | undefined)?.cause).toBeInstanceOf(Error);
    }
  });
});

describe("signInWithGoogleIdp", () => {
  const firebaseApiKey = "test-firebase-api-key";
  const googleIdToken = "google-id-token-123";
  const requestUri = "http://localhost:3000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("成功時にユーザー情報を返す", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          idToken: "firebase-id-token-abc",
          refreshToken: "firebase-refresh-token-def",
          localId: "user-uid-123",
          expiresIn: "3600",
          email: "test@example.com",
          displayName: "Test User",
          photoUrl: "https://lh3.googleusercontent.com/photo",
          needConfirmation: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await signInWithGoogleIdp({ firebaseApiKey, googleIdToken, requestUri });

    expect(result).not.toBeInstanceOf(Error);
    expect(result).toMatchObject({
      idToken: "firebase-id-token-abc",
      refreshToken: "firebase-refresh-token-def",
      localId: "user-uid-123",
      expiresIn: "3600",
      email: "test@example.com",
      displayName: "Test User",
      photoUrl: "https://lh3.googleusercontent.com/photo",
      needConfirmation: false,
    });
  });

  it("needConfirmation=trueの場合にAccountConflictErrorを返す", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          idToken: "firebase-id-token",
          refreshToken: "firebase-refresh-token",
          localId: "user-uid",
          email: "conflict@example.com",
          needConfirmation: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await signInWithGoogleIdp({ firebaseApiKey, googleIdToken, requestUri });

    expect(result).toBeInstanceOf(Error);
    // AccountConflictErrorの_tag確認
    if (result instanceof Error) {
      expect((result as unknown as { _tag: string })._tag).toBe("AccountConflictError");
    }
  });

  it("postBodyの形式が 'id_token=<TOKEN>&providerId=google.com' である", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          idToken: "t",
          refreshToken: "r",
          localId: "uid",
          expiresIn: "3600",
          email: "e@e.com",
          needConfirmation: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await signInWithGoogleIdp({ firebaseApiKey, googleIdToken, requestUri });

    const [, options] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(options.body as string);
    // postBodyはURLエンコード形式の文字列
    expect(body.postBody).toBe(`id_token=${googleIdToken}&providerId=google.com`);
    expect(body.requestUri).toBe("http://localhost:3000");
    expect(body.returnSecureToken).toBe(true);
    expect(body.returnIdpCredential).toBe(true);
  });

  it("FirebaseがINVALID_IDP_RESPONSEエラーを返した場合にFirebaseIdpSigninErrorを返す", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { message: "INVALID_IDP_RESPONSE" },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await signInWithGoogleIdp({ firebaseApiKey, googleIdToken, requestUri });

    expect(result).toBeInstanceOf(Error);
    if (result instanceof Error) {
      expect((result as unknown as { _tag: string })._tag).toBe("FirebaseIdpSigninError");
    }
  });

  it("FirebaseがOPERATION_NOT_ALLOWEDエラーを返した場合にFirebaseIdpSigninErrorを返す", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { message: "OPERATION_NOT_ALLOWED" },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await signInWithGoogleIdp({ firebaseApiKey, googleIdToken, requestUri });

    expect(result).toBeInstanceOf(Error);
    if (result instanceof Error) {
      expect((result as unknown as { _tag: string })._tag).toBe("FirebaseIdpSigninError");
    }
  });

  it("ネットワークエラー時にFirebaseIdpSigninErrorを返す", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const result = await signInWithGoogleIdp({ firebaseApiKey, googleIdToken, requestUri });

    expect(result).toBeInstanceOf(Error);
    if (result instanceof Error) {
      expect((result as unknown as { _tag: string })._tag).toBe("FirebaseIdpSigninError");
    }
  });

  it("JSON parse失敗をcauseに保持してFirebaseIdpSigninErrorを返す", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("not-json", { status: 400, headers: { "Content-Type": "application/json" } }),
    );

    const result = await signInWithGoogleIdp({ firebaseApiKey, googleIdToken, requestUri });

    expect(result).toBeInstanceOf(Error);
    if (result instanceof Error) {
      expect((result as unknown as { _tag: string })._tag).toBe("FirebaseIdpSigninError");
      expect(result.message).toBe("Firebase IdP sign-in failed.");
      expect((result.cause as { _tag?: string } | undefined)?._tag).toBe("FirebaseIdpSigninError");
      expect((result.cause as Error | undefined)?.cause).toBeInstanceOf(Error);
    }
  });
});
