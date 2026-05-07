import { env } from "cloudflare:test";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { mockVerifySessionCookie } from "../../setup";

// ユースケース層をモック - レートリミットテストではDB操作は不要
vi.mock("../../../features/favorite-songs/usecase", () => ({
  registerFavoriteSong: vi.fn(async () => ({
    favorite: {
      userId: "user-uuid-1",
      songId: "song-uuid-1",
      comment: null,
      emoji: null,
      color: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    song: {
      id: "song-uuid-1",
      title: "Test Song",
      appleMusicId: "am-test-001",
    },
  })),
  getFavoriteSongs: vi.fn(),
  getPublicFavoriteSongs: vi.fn(),
  deleteFavoriteSong: vi.fn(),
}));

// Apple Music API もモック
vi.mock("../../../shared/apple-music", () => ({
  fetchSong: vi.fn(),
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

const FAV_SONGS_URL = new URL("/api/me/favorites/songs", "http://localhost:3001");

const makeFavSongRequest = (
  mockEnv: ReturnType<typeof createRateLimitMockEnv>,
  sessionCookie = "valid-session-cookie",
) =>
  app.request(
    FAV_SONGS_URL,
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

describe("POST /api/me/favorites/songs レートリミット", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // セッションcookie検証が成功するようにモック
    mockVerifySessionCookie.mockResolvedValue({
      sub: "firebase-user-1",
      email: "test@example.com",
    });
  });

  it("同一ユーザーから30リクエストは成功し、31リクエスト目は429を返す (VAL-CONTENT-005)", async () => {
    const mockEnv = createRateLimitMockEnv();

    // 30リクエスト: レートリミット内なので全て成功
    for (let i = 0; i < RATE_LIMIT; i++) {
      const res = await makeFavSongRequest(mockEnv);
      expect(res.status).toBe(201);
    }

    // 31リクエスト目: レートリミット超過で429
    const res = await makeFavSongRequest(mockEnv);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      message: "Too many requests. Please try again later.",
    });
  });

  it("未認証リクエストは429ではなく401を返す", async () => {
    const mockEnv = createRateLimitMockEnv();

    // セッションcookieなしでリクエスト → 401 (レートリミットの前に認証エラー)
    const res = await makeFavSongRequest(mockEnv, "");
    expect(res.status).toBe(401);
  });
});
