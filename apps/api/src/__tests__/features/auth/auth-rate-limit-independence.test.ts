import { env } from "cloudflare:test";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { mockCreateSessionCookie } from "../../setup";

// getConnInfo をモックしてテスト用IPアドレスを制御可能にする
// vi.mock のクロージャで変数再代入を反映するため、ミュータブルなオブジェクトを使用
const mockConnInfo = { remote: { address: "192.168.1.1" } };

vi.mock("hono/cloudflare-workers", async () => {
  const actual = await vi.importActual("hono/cloudflare-workers");
  return {
    ...actual,
    getConnInfo: () => mockConnInfo,
  };
});

// Google OAuth ハンドラが依存するモジュールをモック
const mockGenerateOAuthState = vi.hoisted(() => vi.fn());

vi.mock("../../../shared/auth/oauth-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/auth/oauth-state")>();
  return {
    ...actual,
    generateOAuthState: mockGenerateOAuthState,
  };
});

vi.mock("../../../shared/firebase/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDb: vi.fn(),
}));

// モック適用後にテスト対象をインポート
import { signInWithPassword } from "../../../shared/firebase/firebase-rest";
import { signUpWithPassword } from "../../../shared/firebase/firebase-rest";
import { createDb } from "../../../shared/db";
import { app } from "../../../index";

/** AUTH_SIGNIN_RATE_LIMITER の閾値 */
const SIGNIN_RATE_LIMIT = 5;

/**
 * 各バインディングが独立してカウントを管理することを検証するテスト用envを作成
 *
 * - AUTH_SIGNIN_RATE_LIMITER: SIGNIN_RATE_LIMIT回までsuccess=true、以降はfalse
 * - AUTH_SIGNUP_RATE_LIMITER: 常にsuccess=true
 * - AUTH_GOOGLE_RATE_LIMITER: 常にsuccess=true
 */
const createIndependentRateLimitMockEnv = () => {
  let signinCallCount = 0;
  return {
    ...env,
    AUTH_SIGNIN_RATE_LIMITER: {
      limit: vi.fn(async () => {
        signinCallCount++;
        return { success: signinCallCount <= SIGNIN_RATE_LIMIT };
      }),
    },
    AUTH_SIGNUP_RATE_LIMITER: {
      limit: vi.fn(async () => ({ success: true })),
    },
    AUTH_GOOGLE_RATE_LIMITER: {
      limit: vi.fn(async () => ({ success: true })),
    },
  };
};

/**
 * DB モック: ユーザーレコード作成成功をシミュレート
 */
const mockDbWithUserInsert = (rows: unknown[] = [{ id: "uuid-user" }]) => {
  vi.mocked(createDb).mockReturnValue({
    execute: vi.fn(() => Promise.resolve([])),
    transaction: vi.fn(async (fn) =>
      fn({
        execute: vi.fn(() => Promise.resolve([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoUpdate: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue(rows),
            })),
          })),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue(rows),
            })),
          })),
        })),
      }),
    ),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue(rows),
        })),
      })),
    })),
  } as never);
};

const SIGN_IN_URL = new URL("/api/auth/sign-in", "http://localhost:3001");
const SIGN_UP_URL = new URL("/api/auth/sign-up", "http://localhost:3001");
const GOOGLE_URL = new URL("/api/auth/google", "http://localhost:3001");

const makeSignInRequest = (mockEnv: ReturnType<typeof createIndependentRateLimitMockEnv>) =>
  app.request(
    SIGN_IN_URL,
    {
      method: "POST",
      headers: [["Content-Type", "application/json"]],
      body: JSON.stringify({ email: "test@example.com", password: "password123" }),
    },
    mockEnv,
  );

const makeSignUpRequest = (mockEnv: ReturnType<typeof createIndependentRateLimitMockEnv>) =>
  app.request(
    SIGN_UP_URL,
    {
      method: "POST",
      headers: [["Content-Type", "application/json"]],
      body: JSON.stringify({ email: "test@example.com", password: "password123" }),
    },
    mockEnv,
  );

const makeGoogleRequest = (mockEnv: ReturnType<typeof createIndependentRateLimitMockEnv>) =>
  app.request(GOOGLE_URL, {}, mockEnv);

describe("認証エンドポイント間のレートリミット独立性 (VAL-AUTH-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sign-in レートリミットを消費しても sign-up と Google OAuth は影響を受けない", async () => {
    // サインイン成功のモック設定
    vi.mocked(signInWithPassword).mockResolvedValue({
      idToken: "test-id-token",
      localId: "user123",
      expiresIn: "3600",
      refreshToken: "test-refresh",
    });
    // サインアップ成功のモック設定
    vi.mocked(signUpWithPassword).mockResolvedValue({
      idToken: "test-id-token",
      localId: "user123",
      expiresIn: "3600",
      refreshToken: "test-refresh",
      isNewUser: true,
    });
    mockCreateSessionCookie.mockResolvedValue("test-session-cookie");
    // Google OAuth リダイレクト成功のモック設定
    mockGenerateOAuthState.mockResolvedValue({ nonce: "test-nonce", token: "test-state" });
    mockDbWithUserInsert();

    const mockEnv = createIndependentRateLimitMockEnv();

    // 1) sign-in のレートリミットを消費し尽くす (5回成功 → 6回目で429)
    for (let i = 0; i < SIGNIN_RATE_LIMIT; i++) {
      const res = await makeSignInRequest(mockEnv);
      expect(res.status).not.toBe(429);
    }
    // sign-in がレートリミットに達したことを確認
    const signinExhausted = await makeSignInRequest(mockEnv);
    expect(signinExhausted.status).toBe(429);

    // 2) sign-up はまだレートリミットに影響されていないことを確認
    const signupRes = await makeSignUpRequest(mockEnv);
    expect(signupRes.status).not.toBe(429);

    // 3) Google OAuth もまだレートリミットに影響されていないことを確認
    const googleRes = await makeGoogleRequest(mockEnv);
    expect(googleRes.status).not.toBe(429);
  });

  it("各バインディングが独立したカウンターを追跡する", async () => {
    // サインイン失敗モック (認証情報は検証しないためモック不要だが、
    // レートリミットミドルウェアはハンドラの前に実行される)
    const { AuthRestError } = await import("@repo/errors");
    vi.mocked(signInWithPassword).mockResolvedValue(
      new AuthRestError({
        message: "Invalid email address or password.",
        statusCode: 401,
      }),
    );
    // サインアップ成功のモック設定
    vi.mocked(signUpWithPassword).mockResolvedValue({
      idToken: "test-id-token",
      localId: "user123",
      expiresIn: "3600",
      refreshToken: "test-refresh",
      isNewUser: true,
    });
    mockCreateSessionCookie.mockResolvedValue("test-session-cookie");
    mockGenerateOAuthState.mockResolvedValue({ nonce: "test-nonce", token: "test-state" });
    mockDbWithUserInsert();

    const mockEnv = createIndependentRateLimitMockEnv();

    // sign-in を限界まで使い切る (6回リクエスト)
    for (let i = 0; i < SIGNIN_RATE_LIMIT + 1; i++) {
      await makeSignInRequest(mockEnv);
    }

    // AUTH_SIGNIN_RATE_LIMITER.limit が6回呼ばれたことを確認
    expect(mockEnv.AUTH_SIGNIN_RATE_LIMITER.limit).toHaveBeenCalledTimes(SIGNIN_RATE_LIMIT + 1);

    // sign-up に1回リクエスト → AUTH_SIGNUP_RATE_LIMITER.limit が1回だけ呼ばれる
    await makeSignUpRequest(mockEnv);
    expect(mockEnv.AUTH_SIGNUP_RATE_LIMITER.limit).toHaveBeenCalledTimes(1);

    // Google OAuth に1回リクエスト → AUTH_GOOGLE_RATE_LIMITER.limit が1回だけ呼ばれる
    await makeGoogleRequest(mockEnv);
    expect(mockEnv.AUTH_GOOGLE_RATE_LIMITER.limit).toHaveBeenCalledTimes(1);
  });
});
