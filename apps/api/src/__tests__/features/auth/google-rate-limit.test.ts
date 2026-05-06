import { env } from "cloudflare:test";
import { describe, expect, it, vi, beforeEach } from "vitest";

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
import { app } from "../../../index";

/** AUTH_GOOGLE_RATE_LIMITER の閾値 */
const RATE_LIMIT = 10;

/**
 * レートリミットモック付きのテスト用envを作成
 * RATE_LIMIT回まではsuccess=true、それ以降はsuccess=falseを返す
 */
const createRateLimitMockEnv = () => {
  let callCount = 0;
  return {
    ...env,
    AUTH_GOOGLE_RATE_LIMITER: {
      limit: vi.fn(async () => {
        callCount++;
        return { success: callCount <= RATE_LIMIT };
      }),
    },
  };
};

const GOOGLE_URL = new URL("/api/auth/google", "http://localhost:3001");

const makeGoogleRequest = (mockEnv: ReturnType<typeof createRateLimitMockEnv>) =>
  app.request(GOOGLE_URL, {}, mockEnv);

describe("GET /api/auth/google レートリミット", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("同一IPから10リクエストは成功し、11リクエスト目は429を返す (VAL-AUTH-003)", async () => {
    // Google OAuth リダイレクト成功のモック設定
    mockGenerateOAuthState.mockResolvedValue({ nonce: "test-nonce", token: "test-state" });

    const mockEnv = createRateLimitMockEnv();

    // 10リクエスト: レートリミット内なので全て成功 (非429)
    for (let i = 0; i < RATE_LIMIT; i++) {
      const res = await makeGoogleRequest(mockEnv);
      expect(res.status).not.toBe(429);
    }

    // 11リクエスト目: レートリミット超過で429
    const res = await makeGoogleRequest(mockEnv);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      message: "Too many requests. Please try again later.",
    });
  });
});
