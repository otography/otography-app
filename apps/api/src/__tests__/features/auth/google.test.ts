import { describe, expect, it, vi, beforeEach } from "vitest";
import { mockCreateSessionCookie, mockSetRefreshTokenCookie } from "../../setup";
import { testRequest } from "../../helpers/test-client";

// --- モック関数（vi.hoistedで定義し、モックとテストの両方で参照可能にする） ---
const mockGenerateOAuthState = vi.hoisted(() => vi.fn());
const mockVerifyOAuthState = vi.hoisted(() => vi.fn());
const mockExchangeGoogleCode = vi.hoisted(() => vi.fn());
const mockSignInWithGoogleIdp = vi.hoisted(() => vi.fn());

// --- モック定義 ---
vi.mock("../../../shared/auth/oauth-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/auth/oauth-state")>();
  return {
    ...actual,
    generateOAuthState: mockGenerateOAuthState,
    verifyOAuthState: mockVerifyOAuthState,
  };
});

vi.mock("../../../shared/firebase/firebase-google", () => ({
  exchangeGoogleCode: mockExchangeGoogleCode,
  signInWithGoogleIdp: mockSignInWithGoogleIdp,
}));

vi.mock("../../../shared/db", () => ({
  createDb: vi.fn(() => ({ transaction: vi.fn() })),
}));

// --- テスト定数 ---
const VALID_STATE = "valid-state-jwt-token";
const VALID_NONCE = "test-nonce-uuid";
const VALID_CODE = "valid-google-auth-code";
const GOOGLE_ID_TOKEN = "google-id-token-123";
const FIREBASE_ID_TOKEN = "firebase-id-token-abc";
const FIREBASE_REFRESH_TOKEN = "firebase-refresh-token-def";
const SESSION_COOKIE = "test-session-cookie";

describe("GET /api/auth/google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Google OAuth URLへ302リダイレクトする", async () => {
    mockGenerateOAuthState.mockResolvedValue({ nonce: VALID_NONCE, token: VALID_STATE });

    const res = await testRequest("/api/auth/google");

    expect(res.status).toBe(302);
    const location = res.headers.get("Location");
    expect(location).toBeTruthy();

    const url = new URL(location!);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");

    // nonce cookieがセットされることを確認
    expect(res.getCookie("__Host-otography_oauth_nonce")).toBe(VALID_NONCE);
  });

  it("正しいクエリパラメータを含む", async () => {
    mockGenerateOAuthState.mockResolvedValue({ nonce: VALID_NONCE, token: VALID_STATE });

    const res = await testRequest("/api/auth/google");
    const location = res.headers.get("Location")!;
    const url = new URL(location);

    // テスト環境のenv値が使用される
    expect(url.searchParams.get("client_id")).toBeTruthy();
    expect(url.searchParams.get("redirect_uri")).toContain("/api/auth/google/callback");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe(VALID_STATE);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
  });

  it("redirectクエリパラメータをgenerateOAuthStateに渡す", async () => {
    mockGenerateOAuthState.mockResolvedValue({ nonce: VALID_NONCE, token: VALID_STATE });

    await testRequest("/api/auth/google?redirect=/custom-path");

    expect(mockGenerateOAuthState).toHaveBeenCalledWith(
      expect.any(String),
      "/custom-path",
      undefined,
    );
  });

  it("redirectクエリパラメータなしの場合、generateOAuthStateにredirectを渡さない", async () => {
    mockGenerateOAuthState.mockResolvedValue({ nonce: VALID_NONCE, token: VALID_STATE });

    await testRequest("/api/auth/google");

    expect(mockGenerateOAuthState).toHaveBeenCalledWith(expect.any(String), undefined, undefined);
  });

  it("state生成失敗時に/login?error=oauth_failedへリダイレクトする", async () => {
    const { OAuthStateError } = await import("@repo/errors");
    mockGenerateOAuthState.mockResolvedValue(
      new OAuthStateError({ message: "Failed to generate state." }),
    );

    const res = await testRequest("/api/auth/google");

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/login?error=oauth_failed");
  });

  it("fromクエリパラメータをgenerateOAuthStateに渡す", async () => {
    mockGenerateOAuthState.mockResolvedValue({ nonce: VALID_NONCE, token: VALID_STATE });

    await testRequest("/api/auth/google?from=/signup");

    expect(mockGenerateOAuthState).toHaveBeenCalledWith(expect.any(String), undefined, "/signup");
  });

  it("fromクエリパラメータが絶対URLの場合、undefinedとして扱う（オープンリダイレクト防止）", async () => {
    mockGenerateOAuthState.mockResolvedValue({ nonce: VALID_NONCE, token: VALID_STATE });

    await testRequest("/api/auth/google?from=https://evil.com");

    expect(mockGenerateOAuthState).toHaveBeenCalledWith(expect.any(String), undefined, undefined);
  });

  it("fromクエリパラメータが//プロトコル相対URLの場合、undefinedとして扱う", async () => {
    mockGenerateOAuthState.mockResolvedValue({ nonce: VALID_NONCE, token: VALID_STATE });

    await testRequest("/api/auth/google?from=//evil.com");

    expect(mockGenerateOAuthState).toHaveBeenCalledWith(expect.any(String), undefined, undefined);
  });
});

describe("GET /api/auth/google/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyOAuthState.mockResolvedValue({
      nonce: VALID_NONCE,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      redirect: "/account",
    });
    mockExchangeGoogleCode.mockResolvedValue({
      id_token: GOOGLE_ID_TOKEN,
      access_token: "google-access-token",
    });
    mockSignInWithGoogleIdp.mockResolvedValue({
      idToken: FIREBASE_ID_TOKEN,
      refreshToken: FIREBASE_REFRESH_TOKEN,
      localId: "user-uid-123",
      email: "test@example.com",
      displayName: "Test User",
      photoUrl: "",
      needConfirmation: false,
    });
    mockCreateSessionCookie.mockResolvedValue(SESSION_COOKIE);
    mockSetRefreshTokenCookie.mockResolvedValue(undefined);
  });

  // --- 成功ケース ---

  it("既存ユーザーを/accountへリダイレクトし、セッションCookieを設定する", async () => {
    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      { cookie: { "__Host-otography_oauth_nonce": VALID_NONCE } },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/account");

    // セッションCookieとリフレッシュトークンCookieが設定される
    expect(res.getCookie("otography_session")).toBe(SESSION_COOKIE);
    expect(mockSetRefreshTokenCookie).toHaveBeenCalledWith(
      expect.anything(),
      FIREBASE_REFRESH_TOKEN,
    );
  });

  it("新規ユーザーでもstate.redirectにリダイレクトする（setup-profile遷移はフロントエンド担当）", async () => {
    mockSignInWithGoogleIdp.mockResolvedValue({
      idToken: FIREBASE_ID_TOKEN,
      refreshToken: FIREBASE_REFRESH_TOKEN,
      localId: "new-user-uid",
      email: "new@example.com",
      displayName: "New User",
      photoUrl: "",
      needConfirmation: false,
    });

    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      { cookie: { "__Host-otography_oauth_nonce": VALID_NONCE } },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    // APIはstate.redirect（デフォルト/account）にリダイレクト
    // 新規ユーザーの/setup-profile遷移はフロントエンドのrequireAuth()が担当
    expect(location).toContain("/account");

    // セッションCookieとリフレッシュトークンCookieが設定される
    expect(res.getCookie("otography_session")).toBe(SESSION_COOKIE);
    expect(mockSetRefreshTokenCookie).toHaveBeenCalledWith(
      expect.anything(),
      FIREBASE_REFRESH_TOKEN,
    );
  });

  it("state内のredirectが優先される", async () => {
    mockVerifyOAuthState.mockResolvedValue({
      nonce: VALID_NONCE,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      redirect: "/custom-redirect",
    });

    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      { cookie: { "__Host-otography_oauth_nonce": VALID_NONCE } },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/custom-redirect");
  });

  it("新規ユーザーでもstate内のredirectを尊重する（setup-profile遷移はフロントエンド担当）", async () => {
    mockVerifyOAuthState.mockResolvedValue({
      nonce: VALID_NONCE,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      redirect: "/custom-redirect",
    });
    mockSignInWithGoogleIdp.mockResolvedValue({
      idToken: FIREBASE_ID_TOKEN,
      refreshToken: FIREBASE_REFRESH_TOKEN,
      localId: "new-user-uid",
      email: "new@example.com",
      needConfirmation: false,
    });

    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      { cookie: { "__Host-otography_oauth_nonce": VALID_NONCE } },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    // APIはstate.redirectを尊重（setup-profile判定はフロントエンド担当）
    expect(location).toContain("/custom-redirect");
  });

  // --- エラーケース ---

  it("不正なstateの場合、/login?error=invalid_stateへリダイレクトする", async () => {
    const { OAuthStateError } = await import("@repo/errors");
    mockVerifyOAuthState.mockResolvedValue(
      new OAuthStateError({ message: "Invalid state token." }),
    );

    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=tampered-state`,
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/login?error=invalid_state");

    // セッションCookieは設定されない
    expect(res.getCookie("otography_session")).toBeUndefined();
  });

  it("期限切れstateの場合、/login?error=expired_stateへリダイレクトする", async () => {
    const { OAuthStateError } = await import("@repo/errors");
    const jwtExpiredError = new Error("JWT expired");
    jwtExpiredError.name = "JWTExpired";
    mockVerifyOAuthState.mockResolvedValue(
      new OAuthStateError({ message: "Expired state token.", cause: jwtExpiredError }),
    );

    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=expired-state`,
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/login?error=expired_state");
  });

  it("Google トークン交換失敗時、/login?error=oauth_failedへリダイレクトする", async () => {
    const { GoogleTokenExchangeError } = await import("@repo/errors");
    mockExchangeGoogleCode.mockResolvedValue(
      new GoogleTokenExchangeError({ message: "Token exchange failed." }),
    );

    const res = await testRequest(`/api/auth/google/callback?code=bad-code&state=${VALID_STATE}`, {
      cookie: { "__Host-otography_oauth_nonce": VALID_NONCE },
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/login?error=oauth_failed");

    // セッションCookieは設定されない
    expect(res.getCookie("otography_session")).toBeUndefined();
    expect(mockCreateSessionCookie).not.toHaveBeenCalled();
  });

  it("Firebase認証失敗時、/login?error=firebase_auth_failedへリダイレクトする", async () => {
    const { FirebaseIdpSigninError } = await import("@repo/errors");
    mockSignInWithGoogleIdp.mockResolvedValue(
      new FirebaseIdpSigninError({ message: "Firebase auth failed." }),
    );

    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      { cookie: { "__Host-otography_oauth_nonce": VALID_NONCE } },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/login?error=firebase_auth_failed");
  });

  it("needConfirmation時、/login?error=account_existsへリダイレクトする", async () => {
    const { AccountConflictError } = await import("@repo/errors");
    mockSignInWithGoogleIdp.mockResolvedValue(
      new AccountConflictError({ message: "Account already exists." }),
    );

    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      { cookie: { "__Host-otography_oauth_nonce": VALID_NONCE } },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/login?error=account_exists");
  });

  it("セッションCookie作成失敗時、/login?error=session_failedへリダイレクトする", async () => {
    const { AuthError } = await import("@repo/errors/server");
    mockCreateSessionCookie.mockResolvedValue(
      new AuthError({
        message: "Session creation failed.",
        code: "session-failed",
        statusCode: 502,
      }),
    );

    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      { cookie: { "__Host-otography_oauth_nonce": VALID_NONCE } },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/login?error=session_failed");
  });

  it("リフレッシュトークンCookie設定失敗時、/login?error=session_failedへリダイレクトする", async () => {
    const { AuthRestError } = await import("@repo/errors");
    mockSetRefreshTokenCookie.mockResolvedValue(
      new AuthRestError({ message: "Failed to set refresh token.", statusCode: 500 }),
    );

    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      { cookie: { "__Host-otography_oauth_nonce": VALID_NONCE } },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/login?error=session_failed");
  });

  it("Google側でエラー（キャンセル等）がある場合、/login?error=oauth_failedへリダイレクトする", async () => {
    const res = await testRequest(
      `/api/auth/google/callback?error=access_denied&state=${VALID_STATE}`,
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/login?error=oauth_failed");
  });

  it("state.redirectが絶対URLの場合、/accountへフォールバックする（オープンリダイレクト防止）", async () => {
    mockVerifyOAuthState.mockResolvedValue({
      nonce: VALID_NONCE,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      redirect: "https://evil.com",
    });

    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      { cookie: { "__Host-otography_oauth_nonce": VALID_NONCE } },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/account");
    expect(location).not.toContain("evil.com");
  });

  it("state.redirectが // プロトコル相対URLの場合、/accountへフォールバックする", async () => {
    mockVerifyOAuthState.mockResolvedValue({
      nonce: VALID_NONCE,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      redirect: "//evil.com",
    });

    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      { cookie: { "__Host-otography_oauth_nonce": VALID_NONCE } },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/account");
    expect(location).not.toContain("evil.com");
  });

  it("nonce cookieがない場合、/login?error=invalid_stateへリダイレクトする（Login CSRF防止）", async () => {
    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      // nonce cookieを送信しない
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/login?error=invalid_state");
    expect(res.getCookie("otography_session")).toBeUndefined();
  });

  it("nonce cookieがstate JWTのnonceと一致しない場合、/login?error=invalid_stateへリダイレクトする（Login CSRF防止）", async () => {
    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      { cookie: { "__Host-otography_oauth_nonce": "different-nonce-value" } },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/login?error=invalid_state");
    expect(res.getCookie("otography_session")).toBeUndefined();
  });

  it("成功時にnonce cookieが削除される", async () => {
    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      { cookie: { "__Host-otography_oauth_nonce": VALID_NONCE } },
    );

    expect(res.status).toBe(302);
    // nonce cookie が maxAge=0 でクリアされる
    const nonceCookie = res.getCookie("__Host-otography_oauth_nonce");
    expect(nonceCookie).toBe("");
  });

  // --- from パラメータ（エラー時のリダイレクト先）---

  it("stateにfrom=/signupがある場合、Firebase認証失敗時に/signup?error=...へリダイレクトする", async () => {
    const { FirebaseIdpSigninError } = await import("@repo/errors");
    mockVerifyOAuthState.mockResolvedValue({
      nonce: VALID_NONCE,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      redirect: "/account",
      from: "/signup",
    });
    mockSignInWithGoogleIdp.mockResolvedValue(
      new FirebaseIdpSigninError({ message: "Firebase auth failed." }),
    );

    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      { cookie: { "__Host-otography_oauth_nonce": VALID_NONCE } },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/signup?error=firebase_auth_failed");
    expect(location).not.toContain("/login");
  });

  it("stateにfromがない場合、エラー時は/login?error=...へリダイレクトする（デフォルト）", async () => {
    const { FirebaseIdpSigninError } = await import("@repo/errors");
    mockSignInWithGoogleIdp.mockResolvedValue(
      new FirebaseIdpSigninError({ message: "Firebase auth failed." }),
    );

    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      { cookie: { "__Host-otography_oauth_nonce": VALID_NONCE } },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/login?error=firebase_auth_failed");
  });

  it("state.fromが絶対URLの場合、/loginにフォールバックする（オープンリダイレクト防止）", async () => {
    const { FirebaseIdpSigninError } = await import("@repo/errors");
    mockVerifyOAuthState.mockResolvedValue({
      nonce: VALID_NONCE,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      redirect: "/account",
      from: "https://evil.com",
    });
    mockSignInWithGoogleIdp.mockResolvedValue(
      new FirebaseIdpSigninError({ message: "Firebase auth failed." }),
    );

    const res = await testRequest(
      `/api/auth/google/callback?code=${VALID_CODE}&state=${VALID_STATE}`,
      { cookie: { "__Host-otography_oauth_nonce": VALID_NONCE } },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("/login?error=firebase_auth_failed");
    expect(location).not.toContain("evil.com");
  });
});
