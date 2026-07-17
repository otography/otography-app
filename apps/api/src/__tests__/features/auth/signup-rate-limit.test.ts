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

vi.mock("../../../shared/firebase/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDbClient: vi.fn(),
}));

// モック適用後にテスト対象をインポート
import { signUpWithPassword } from "../../../shared/firebase/firebase-rest";
import { createDbClient } from "../../../shared/db";
import { app } from "../../../index";

/** AUTH_SIGNUP_RATE_LIMITER の閾値 */
const RATE_LIMIT = 3;

/**
 * レートリミットモック付きのテスト用envを作成
 * RATE_LIMIT回まではsuccess=true、それ以降はsuccess=falseを返す
 */
const createRateLimitMockEnv = () => {
  let callCount = 0;
  return {
    ...env,
    AUTH_SIGNUP_RATE_LIMITER: {
      limit: vi.fn(async () => {
        callCount++;
        return { success: callCount <= RATE_LIMIT };
      }),
    },
  };
};

/**
 * DB モック: ユーザーレコード作成成功をシミュレート
 */
const mockDbWithUserInsert = (rows: unknown[] = [{ id: "uuid-user" }]) => {
  vi.mocked(createDbClient).mockReturnValue({
    db: {
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
    },
    end: async () => undefined,
  } as never);
};

const SIGN_UP_URL = new URL("/api/auth/sign-up", "http://localhost:3001");

const makeSignUpRequest = (mockEnv: ReturnType<typeof createRateLimitMockEnv>) =>
  app.request(
    SIGN_UP_URL,
    {
      method: "POST",
      headers: [["Content-Type", "application/json"]],
      body: JSON.stringify({ email: "test@example.com", password: "password123" }),
    },
    mockEnv,
  );

describe("POST /api/auth/sign-up レートリミット", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("同一IPから3リクエストは成功し、4リクエスト目は429を返す (VAL-AUTH-002)", async () => {
    // サインアップ成功のモック設定
    vi.mocked(signUpWithPassword).mockResolvedValue({
      idToken: "test-id-token",
      localId: "user123",
      expiresIn: "3600",
      refreshToken: "test-refresh",
      isNewUser: true,
    });
    mockCreateSessionCookie.mockResolvedValue("test-session-cookie");
    mockDbWithUserInsert();

    const mockEnv = createRateLimitMockEnv();

    // 3リクエスト: レートリミット内なので全て成功 (非429)
    for (let i = 0; i < RATE_LIMIT; i++) {
      const res = await makeSignUpRequest(mockEnv);
      expect(res.status).not.toBe(429);
    }

    // 4リクエスト目: レートリミット超過で429
    const res = await makeSignUpRequest(mockEnv);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/rate-limit-exceeded",
      title: "Rate Limit Exceeded",
      status: 429,
      detail: "Too many requests. Please try again later.",
    });
  });

  it("無効な認証情報(401)のリクエストもレートリミットにカウントされる", async () => {
    // サインアップ失敗のモック設定
    const { AuthRestError } = await import("@repo/errors");
    vi.mocked(signUpWithPassword).mockResolvedValue(
      new AuthRestError({ message: "Invalid email address or password.", statusCode: 401 }),
    );

    const mockEnv = createRateLimitMockEnv();

    // 3リクエスト: 無効な認証情報で401を返すが、レートリミットにはカウントされる
    for (let i = 0; i < RATE_LIMIT; i++) {
      const res = await makeSignUpRequest(mockEnv);
      expect(res.status).toBe(401);
    }

    // 4リクエスト目: レートリミット超過で429 (401ではない)
    const res = await makeSignUpRequest(mockEnv);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/rate-limit-exceeded",
      title: "Rate Limit Exceeded",
      status: 429,
      detail: "Too many requests. Please try again later.",
    });
  });
});
