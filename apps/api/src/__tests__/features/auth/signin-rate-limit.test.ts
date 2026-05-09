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
  createDb: vi.fn(),
}));

// モック適用後にテスト対象をインポート
import { signInWithPassword } from "../../../shared/firebase/firebase-rest";
import { createDb } from "../../../shared/db";
import { app } from "../../../index";

/** AUTH_SIGNIN_RATE_LIMITER の閾値 */
const RATE_LIMIT = 5;

/**
 * レートリミットモック付きのテスト用envを作成
 * RATE_LIMIT回まではsuccess=true、それ以降はsuccess=falseを返す
 */
const createRateLimitMockEnv = () => {
  let callCount = 0;
  return {
    ...env,
    AUTH_SIGNIN_RATE_LIMITER: {
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

const makeSignInRequest = (mockEnv: ReturnType<typeof createRateLimitMockEnv>) =>
  app.request(
    SIGN_IN_URL,
    {
      method: "POST",
      headers: [["Content-Type", "application/json"]],
      body: JSON.stringify({ email: "test@example.com", password: "password123" }),
    },
    mockEnv,
  );

describe("POST /api/auth/sign-in レートリミット", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("同一IPから5リクエストは成功し、6リクエスト目は429を返す (VAL-AUTH-001)", async () => {
    // サインイン成功のモック設定
    vi.mocked(signInWithPassword).mockResolvedValue({
      idToken: "test-id-token",
      localId: "user123",
      expiresIn: "3600",
      refreshToken: "test-refresh",
    });
    mockCreateSessionCookie.mockResolvedValue("test-session-cookie");
    mockDbWithUserInsert();

    const mockEnv = createRateLimitMockEnv();

    // 5リクエスト: レートリミット内なので全て成功 (非429)
    for (let i = 0; i < RATE_LIMIT; i++) {
      const res = await makeSignInRequest(mockEnv);
      expect(res.status).not.toBe(429);
    }

    // 6リクエスト目: レートリミット超過で429
    const res = await makeSignInRequest(mockEnv);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/too-many-requests",
      title: "Too Many Requests",
      status: 429,
      detail: "Too many requests. Please try again later.",
    });
  });

  it("無効な認証情報(401)のリクエストもレートリミットにカウントされる (VAL-AUTH-005)", async () => {
    // サインイン失敗のモック設定
    const { AuthRestError } = await import("@repo/errors");
    vi.mocked(signInWithPassword).mockResolvedValue(
      new AuthRestError({ message: "Invalid email address or password.", statusCode: 401 }),
    );

    const mockEnv = createRateLimitMockEnv();

    // 5リクエスト: 無効な認証情報で401を返すが、レートリミットにはカウントされる
    for (let i = 0; i < RATE_LIMIT; i++) {
      const res = await makeSignInRequest(mockEnv);
      expect(res.status).toBe(401);
    }

    // 6リクエスト目: レートリミット超過で429 (401ではない)
    const res = await makeSignInRequest(mockEnv);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/too-many-requests",
      title: "Too Many Requests",
      status: 429,
      detail: "Too many requests. Please try again later.",
    });
  });
});
