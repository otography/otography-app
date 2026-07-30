import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockResolveSession } from "../../setup";

vi.mock("../../../shared/db", () => ({
  createDbClient: vi.fn(() => ({ db: {}, end: async () => undefined })),
}));

import { app } from "../../../index";

/** APPLE_MUSIC_TOKEN_RATE_LIMITER の閾値 */
const RATE_LIMIT = 10;

/**
 * レートリミットモック付きのテスト用envを作成
 * RATE_LIMIT回まではsuccess=true、それ以降はsuccess=falseを返す
 */
const createRateLimitMockEnv = () => {
  let callCount = 0;
  return {
    ...env,
    APPLE_MUSIC_TOKEN_RATE_LIMITER: {
      limit: vi.fn(async () => {
        callCount++;
        return { success: callCount <= RATE_LIMIT };
      }),
    },
  };
};

const TOKEN_URL = new URL("/api/apple-music/token", "http://localhost:3001");

const makeTokenRequest = (
  mockEnv: ReturnType<typeof createRateLimitMockEnv>,
  sessionCookie = "a".repeat(43),
) =>
  app.request(
    TOKEN_URL,
    {
      method: "GET",
      headers: sessionCookie ? [["Cookie", `otography_session=${sessionCookie}`]] : [],
    },
    mockEnv,
  );

describe("GET /api/apple-music/token レートリミット", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSession.mockResolvedValue({
      claims: {
        sub: "firebase-user-1",
        email: "test@example.com",
      },
      session: { id: "sess", userId: "uuid", version: 1 },
    });
  });

  it("同一ユーザーから10リクエストは成功し、11リクエスト目は429を返す", async () => {
    const mockEnv = createRateLimitMockEnv();

    for (let i = 0; i < RATE_LIMIT; i++) {
      const res = await makeTokenRequest(mockEnv);
      expect(res.status).toBe(200);
    }

    const res = await makeTokenRequest(mockEnv);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/rate-limit-exceeded",
      title: "Rate Limit Exceeded",
      status: 429,
      detail: "Too many requests. Please try again later.",
    });
  });

  it("未認証リクエストは429ではなく401を返す", async () => {
    const mockEnv = createRateLimitMockEnv();

    const res = await makeTokenRequest(mockEnv, "");
    expect(res.status).toBe(401);
  });
});
