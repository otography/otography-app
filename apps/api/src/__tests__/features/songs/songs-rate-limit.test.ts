import { env } from "cloudflare:test";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { mockVerifySessionCookie } from "../../setup";

// ユースケース層をモック - レートリミットテストではDB操作は不要
vi.mock("../../../features/songs/usecase", () => ({
  registerSong: vi.fn(async () => ({
    song: {
      id: "song-uuid-1",
      title: "Test Song",
      appleMusicId: "am-test-001",
      length: 180,
      isrcs: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  })),
  getSongs: vi.fn(),
  getSong: vi.fn(),
  syncSong: vi.fn(),
}));

// Apple Music API もモック
vi.mock("../../../shared/apple-music", () => ({
  fetchSong: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDbClient: vi.fn(() => ({ db: {}, end: async () => undefined })),
}));

// モック適用後にテスト対象をインポート
import { app } from "../../../index";

/** CONTENT_RATE_LIMITER の閾値 */
const RATE_LIMIT = 30;

/**
 * レートリミットモック付きのテスト用envを作成
 * RATE_LIMIT回まではsuccess=true、それ以降はsuccess=falseを返す
 */
const createRateLimitMockEnv = () => {
  let callCount = 0;
  return {
    ...env,
    CONTENT_RATE_LIMITER: {
      limit: vi.fn(async () => {
        callCount++;
        return { success: callCount <= RATE_LIMIT };
      }),
    },
  };
};

const SONGS_URL = new URL("/api/songs", "http://localhost:3001");

const makeSongRequest = (
  mockEnv: ReturnType<typeof createRateLimitMockEnv>,
  sessionCookie = "valid-session-cookie",
) =>
  app.request(
    SONGS_URL,
    {
      method: "POST",
      headers: [
        ["Content-Type", "application/json"],
        ["Cookie", `otography_session=${sessionCookie}`],
      ],
      body: JSON.stringify({ appleMusicId: "am-test-001" }),
    },
    mockEnv,
  );

describe("POST /api/songs レートリミット", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // セッションcookie検証が成功するようにモック
    mockVerifySessionCookie.mockResolvedValue({
      sub: "firebase-user-1",
      email: "test@example.com",
    });
  });

  it("同一ユーザーから30リクエストは成功し、31リクエスト目は429を返す (VAL-CONTENT-003)", async () => {
    const mockEnv = createRateLimitMockEnv();

    // 30リクエスト: レートリミット内なので全て201
    for (let i = 0; i < RATE_LIMIT; i++) {
      const res = await makeSongRequest(mockEnv);
      expect(res.status).toBe(201);
    }

    // 31リクエスト目: レートリミット超過で429
    const res = await makeSongRequest(mockEnv);
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

    // セッションcookieなしでリクエスト → 401 (レートリミットの前に認証エラー)
    const res = await makeSongRequest(mockEnv, "");
    expect(res.status).toBe(401);
  });
});
